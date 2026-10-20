import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { Telemetry } from '../modules/telemetry/telemetry.model';
import { Device } from '../modules/devices/device.model';
import { clearDatabase, setupTestDatabase, teardownTestDatabase, TEST_DEVICE_ID } from './helpers/test-db';

const app = createApp();

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: TEST_DEVICE_ID,
    timestamp: '2026-10-17T18:30:00.000Z',
    sensors: { ax: 0.12, ay: -0.08, az: 9.75, gx: 0.3, gy: -0.5, gz: 0.1 },
    posture: { label: 'SLOUCHING', angle: 18.5, confidence: 0.92, badDurationSeconds: 4 },
    alert: true,
    battery: 78,
    ...overrides,
  };
}

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/v1/telemetry', () => {
  it('stores a valid sample and answers 201', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Telemetry stored');
    expect(typeof response.body.data.id).toBe('string');
    expect(response.body.data.duplicate).toBe(false);

    const stored = await Telemetry.findById(response.body.data.id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.deviceId).toBe(TEST_DEVICE_ID);
    expect(stored?.posture.label).toBe('SLOUCHING');
    expect(stored?.posture.angle).toBe(18.5);
    expect(stored?.sensors?.az).toBe(9.75);
    expect(stored?.alert).toBe(true);
    expect(stored?.battery).toBe(78);
    expect(stored?.samplingHz).toBe(10);

    const device = await Device.findOne({ deviceId: TEST_DEVICE_ID }).lean();
    expect(device?.status).toBe('online');
    expect(device?.lastTelemetry?.posture).toBe('SLOUCHING');
    expect(device?.batteryLevel).toBe(78);
  });

  it('never stores the same occurrence twice and answers 200 on a retry', async () => {
    const first = await request(app).post('/api/v1/telemetry').send(validPayload()).expect(201);
    const retry = await request(app).post('/api/v1/telemetry').send(validPayload()).expect(200);

    expect(retry.body.message).toBe('Duplicate telemetry ignored');
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(await Telemetry.countDocuments({ deviceId: TEST_DEVICE_ID })).toBe(1);
  });

  it('fills in the server timestamp when the device omits it', async () => {
    const payload = validPayload();
    delete (payload as { timestamp?: string }).timestamp;

    const response = await request(app).post('/api/v1/telemetry').send(payload).expect(201);

    const stored = await Telemetry.findById(response.body.data.id).lean();
    expect(stored?.timestamp).toBeInstanceOf(Date);
    expect(Math.abs((stored?.timestamp as Date).getTime() - Date.now())).toBeLessThan(10_000);
  });

  it('accepts a partial sensor payload (not every field is always available)', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ sensors: { az: 9.8 }, posture: { label: 'GOOD_POSTURE', angle: 2.1 } }))
      .expect(201);

    const stored = await Telemetry.findById(response.body.data.id).lean();
    expect(stored?.sensors?.az).toBe(9.8);
    expect(stored?.sensors?.ax ?? null).toBeNull();
    expect(stored?.sensorError).toBe(false);
  });

  it('accepts telemetry without a sensors object at all', async () => {
    const payload = validPayload({ posture: { label: 'HEAD_FORWARD', angle: 24 } });
    delete (payload as { sensors?: unknown }).sensors;

    await request(app).post('/api/v1/telemetry').send(payload).expect(201);
  });

  it('rejects an invalid posture label with a 400 and an explicit issue', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ posture: { label: 'SITTING_WEIRD', angle: 10 } }))
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body.error.details)).toContain('posture.label');
  });

  it('rejects missing required fields', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send({ deviceId: TEST_DEVICE_ID, alert: true })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const issues = response.body.error.details.issues as { field: string }[];
    expect(issues.some((issue) => issue.field === 'posture')).toBe(true);
  });

  it('rejects numeric values outside the physical sensor range', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ sensors: { ax: 5000 } }))
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range posture angle', async () => {
    await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ posture: { label: 'SLOUCHING', angle: 500 } }))
      .expect(400);
  });

  it('rejects a malformed ISO timestamp', async () => {
    await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ timestamp: 'yesterday afternoon' }))
      .expect(400);
  });

  it('rejects an invalid deviceId', async () => {
    await request(app)
      .post('/api/v1/telemetry')
      .send(validPayload({ deviceId: 'no spaces allowed' }))
      .expect(400);
  });

  it('rejects malformed JSON with a dedicated error code', async () => {
    const response = await request(app)
      .post('/api/v1/telemetry')
      .set('Content-Type', 'application/json')
      .send('{"deviceId": ')
      .expect(400);

    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });
});
