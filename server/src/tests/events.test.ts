import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { PostureEvent } from '../modules/events/event.model';
import { clearDatabase, setupTestDatabase, teardownTestDatabase, TEST_DEVICE_ID } from './helpers/test-db';

const app = createApp();

function telemetry(timestamp: string, label: string, angle: number, alert: boolean) {
  return {
    deviceId: TEST_DEVICE_ID,
    timestamp,
    sensors: { az: 9.8 },
    posture: { label, angle },
    alert,
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

describe('Events API', () => {
  it('stores an event once and treats the retry as a duplicate', async () => {
    const payload = {
      deviceId: TEST_DEVICE_ID,
      type: 'LOW_BATTERY',
      timestamp: '2026-10-17T10:00:00.000Z',
    };

    const first = await request(app).post('/api/v1/events').send(payload).expect(201);
    expect(first.body.message).toBe('Event stored');
    expect(first.body.data.created).toBe(true);

    const retry = await request(app).post('/api/v1/events').send(payload).expect(200);
    expect(retry.body.message).toBe('Event already exists');
    expect(retry.body.data.created).toBe(false);
    expect(retry.body.data.id).toBe(first.body.data.id);

    expect(await PostureEvent.countDocuments({})).toBe(1);
  });

  it('honours an explicit dedupeKey even for a different timestamp', async () => {
    const base = { deviceId: TEST_DEVICE_ID, type: 'SENSOR_ERROR', dedupeKey: 'sensor-error-2026-10-17' };

    const first = await request(app)
      .post('/api/v1/events')
      .send({ ...base, timestamp: '2026-10-17T11:00:00.000Z' })
      .expect(201);
    const second = await request(app)
      .post('/api/v1/events')
      .send({ ...base, timestamp: '2026-10-17T11:00:05.000Z' })
      .expect(200);

    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await PostureEvent.countDocuments({})).toBe(1);
  });

  it('does not create a second event while the posture stays incorrect', async () => {
    await request(app)
      .post('/api/v1/telemetry')
      .send(telemetry('2026-10-17T09:00:00.000Z', 'SLOUCHING', 18, true))
      .expect(201);
    await request(app)
      .post('/api/v1/telemetry')
      .send(telemetry('2026-10-17T09:00:02.000Z', 'SLOUCHING', 18, true))
      .expect(201);

    expect(await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'POSTURE_INCORRECT' })).toBe(1);
    expect(await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'VIBRATION_ALERT' })).toBe(1);
  });

  it('creates a new incorrect-posture event after the posture recovers and degrades again', async () => {
    await request(app)
      .post('/api/v1/telemetry')
      .send(telemetry('2026-10-17T09:10:00.000Z', 'SLOUCHING', 18, true))
      .expect(201);
    await request(app)
      .post('/api/v1/telemetry')
      .send(telemetry('2026-10-17T09:10:02.000Z', 'GOOD_POSTURE', 2, false))
      .expect(201);
    await request(app)
      .post('/api/v1/telemetry')
      .send(telemetry('2026-10-17T09:10:04.000Z', 'SLOUCHING', 18, false))
      .expect(201);

    expect(await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'POSTURE_INCORRECT' })).toBe(2);
    // The vibration event is tied to the alert flag, which only rose once.
    expect(await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'VIBRATION_ALERT' })).toBe(1);
  });

  it('filters events by type and answers 404 for an unknown id', async () => {
    await request(app)
      .post('/api/v1/events')
      .send({ deviceId: TEST_DEVICE_ID, type: 'LOW_BATTERY', timestamp: '2026-10-17T12:00:00.000Z' })
      .expect(201);
    await request(app)
      .post('/api/v1/events')
      .send({ deviceId: TEST_DEVICE_ID, type: 'SENSOR_ERROR', timestamp: '2026-10-17T12:01:00.000Z' })
      .expect(201);

    const filtered = await request(app).get('/api/v1/events?type=LOW_BATTERY').expect(200);
    expect(filtered.body.data.meta.total).toBe(1);
    expect(filtered.body.data.items[0].type).toBe('LOW_BATTERY');
    expect(filtered.body.data.items[0].severity).toBe('warning');

    const missing = await request(app).get('/api/v1/events/0123456789abcdef01234567').expect(404);
    expect(missing.body.error.code).toBe('EVENT_NOT_FOUND');
  });
});
