import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { Session } from '../modules/sessions/session.model';
import { clearDatabase, setupTestDatabase, teardownTestDatabase, TEST_DEVICE_ID } from './helpers/test-db';
import { insertTelemetrySample } from './helpers/fixtures';

const app = createApp();

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('Sessions API', () => {
  it('starts a session and returns the existing active session on a repeat call', async () => {
    const first = await request(app).post('/api/v1/sessions').send({ deviceId: TEST_DEVICE_ID }).expect(201);

    expect(first.body.message).toBe('Session started');
    expect(first.body.data.status).toBe('active');
    expect(first.body.data.endedAt).toBeNull();
    expect(first.body.data.durationSeconds).toBeNull();
    expect(first.body.data.statisticsAreFinal).toBe(false);

    const second = await request(app).post('/api/v1/sessions').send({ deviceId: TEST_DEVICE_ID }).expect(200);

    expect(second.body.message).toBe('Existing active session returned');
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await Session.countDocuments({})).toBe(1);
  });

  it('computes final statistics from real timestamp deltas when the session ends', async () => {
    const startedAt = new Date(Date.now() - 60_000);
    const created = await request(app)
      .post('/api/v1/sessions')
      .send({ deviceId: TEST_DEVICE_ID, startedAt: startedAt.toISOString() })
      .expect(201);

    const sessionId = created.body.data.id as string;

    await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2, at: new Date(startedAt.getTime() + 2000), sessionId });
    await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2, at: new Date(startedAt.getTime() + 4000), sessionId });
    await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(startedAt.getTime() + 6000), sessionId });
    await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(startedAt.getTime() + 8000), sessionId });

    const endedAt = new Date(startedAt.getTime() + 10_000);
    const response = await request(app)
      .patch(`/api/v1/sessions/${sessionId}/end`)
      .send({ endedAt: endedAt.toISOString() })
      .expect(200);

    expect(response.body.message).toBe('Session ended');
    expect(response.body.data.status).toBe('ended');
    expect(response.body.data.endedAt).toBe(endedAt.toISOString());
    expect(response.body.data.durationSeconds).toBe(10);
    expect(response.body.data.statisticsAreFinal).toBe(true);
    expect(response.body.data.statistics.measurements).toBe(4);
    expect(response.body.data.statistics.goodDurationSeconds).toBe(4);
    expect(response.body.data.statistics.badDurationSeconds).toBe(2);
    expect(response.body.data.statistics.goodPosturePercentage).toBe(66.67);
    expect(response.body.data.statistics.incorrectPostureEvents).toBe(1);

    const stored = await Session.findById(sessionId).lean();
    expect(stored?.endedAt).toBeInstanceOf(Date);
    expect(stored?.statistics?.measurements).toBe(4);

    const again = await request(app)
      .patch(`/api/v1/sessions/${sessionId}/end`)
      .send({})
      .expect(200);
    expect(again.body.message).toBe('Session was already ended');
  });

  it('rejects an end timestamp earlier than the session start', async () => {
    const startedAt = new Date();
    const created = await request(app)
      .post('/api/v1/sessions')
      .send({ deviceId: TEST_DEVICE_ID, startedAt: startedAt.toISOString() })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/sessions/${created.body.data.id}/end`)
      .send({ endedAt: new Date(startedAt.getTime() - 10_000).toISOString() })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_SESSION_WINDOW');
  });

  it('answers 404 when ending an unknown session', async () => {
    const response = await request(app)
      .patch('/api/v1/sessions/0123456789abcdef01234567/end')
      .send({})
      .expect(404);

    expect(response.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('lists sessions filtered by status', async () => {
    await request(app).post('/api/v1/sessions').send({ deviceId: TEST_DEVICE_ID }).expect(201);

    const active = await request(app).get('/api/v1/sessions?status=active').expect(200);
    expect(active.body.data.meta.total).toBe(1);

    const ended = await request(app).get('/api/v1/sessions?status=ended').expect(200);
    expect(ended.body.data.meta.total).toBe(0);
  });
});
