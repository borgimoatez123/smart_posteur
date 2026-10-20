import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { Device } from '../modules/devices/device.model';
import { PostureEvent } from '../modules/events/event.model';
import { clearDatabase, setupTestDatabase, teardownTestDatabase, TEST_DEVICE_ID } from './helpers/test-db';

const app = createApp();

function telemetryPayload() {
  return {
    deviceId: TEST_DEVICE_ID,
    timestamp: new Date().toISOString(),
    sensors: { ax: 0.1, ay: -0.1, az: 9.8, gx: 0.2, gy: -0.4, gz: 0.1 },
    posture: { label: 'GOOD_POSTURE', angle: 2.4, confidence: 0.97, badDurationSeconds: 0 },
    alert: false,
    battery: 64,
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

describe('Devices API', () => {
  it('returns an empty list when no device has ever reported', async () => {
    const response = await request(app).get('/api/v1/devices').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.devices).toEqual([]);
    expect(response.body.data.count).toBe(0);
  });

  it('marks a device online as soon as telemetry arrives and exposes the timeouts', async () => {
    await request(app).post('/api/v1/telemetry').send(telemetryPayload()).expect(201);

    const list = await request(app).get('/api/v1/devices').expect(200);
    expect(list.body.data.count).toBe(1);
    expect(list.body.data.devices[0].deviceId).toBe(TEST_DEVICE_ID);
    expect(list.body.data.devices[0].status).toBe('online');
    expect(list.body.data.devices[0].latestPosture).toBe('GOOD_POSTURE');
    expect(list.body.data.devices[0].batteryLevel).toBe(64);

    const status = await request(app).get(`/api/v1/devices/${TEST_DEVICE_ID}/status`).expect(200);
    expect(status.body.data.status).toBe('online');
    expect(status.body.data.offlineTimeoutSeconds).toBe(60);
    expect(status.body.data.heartbeatIntervalSeconds).toBe(15);
    expect(status.body.data.secondsSinceLastSeen).toBeLessThan(5);
  });

  it('reports a device offline when its last contact is older than the offline timeout', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await Device.create({
      deviceId: TEST_DEVICE_ID,
      name: null,
      status: 'online',
      lastSeen: fiveMinutesAgo,
      batteryLevel: 40,
    });

    const response = await request(app).get(`/api/v1/devices/${TEST_DEVICE_ID}/status`).expect(200);

    expect(response.body.data.status).toBe('offline');
    expect(response.body.data.secondsSinceLastSeen).toBeGreaterThanOrEqual(299);
  });

  it('returns 404 for a device the server has never seen', async () => {
    const response = await request(app).get('/api/v1/devices/unknown-device').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('records a heartbeat, detects the reconnect and stores exactly one event', async () => {
    await Device.create({
      deviceId: TEST_DEVICE_ID,
      name: null,
      status: 'offline',
      lastSeen: new Date(Date.now() - 5 * 60 * 1000),
      batteryLevel: 30,
    });

    const reconnect = await request(app)
      .post(`/api/v1/devices/${TEST_DEVICE_ID}/heartbeat`)
      .send({ battery: 42 })
      .expect(200);

    expect(reconnect.body.message).toBe('Heartbeat recorded');
    expect(reconnect.body.data.status).toBe('online');
    expect(reconnect.body.data.reconnectDetected).toBe(true);
    expect(reconnect.body.data.nextHeartbeatSeconds).toBe(15);

    const device = await Device.findOne({ deviceId: TEST_DEVICE_ID }).lean();
    expect(device?.status).toBe('online');
    expect(device?.batteryLevel).toBe(42);

    expect(
      await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'DEVICE_RECONNECTED' }),
    ).toBe(1);

    const steady = await request(app)
      .post(`/api/v1/devices/${TEST_DEVICE_ID}/heartbeat`)
      .send({})
      .expect(200);

    expect(steady.body.data.reconnectDetected).toBe(false);
    expect(
      await PostureEvent.countDocuments({ deviceId: TEST_DEVICE_ID, type: 'DEVICE_RECONNECTED' }),
    ).toBe(1);
  });
});
