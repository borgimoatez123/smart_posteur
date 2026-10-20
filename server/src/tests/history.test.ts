import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { clearDatabase, setupTestDatabase, teardownTestDatabase, TEST_DEVICE_ID } from './helpers/test-db';
import { insertTelemetrySample } from './helpers/fixtures';

const app = createApp();

async function seedFiveSamples() {
  const now = Date.now();
  await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2, at: new Date(now - 300_000) });
  await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 3, at: new Date(now - 240_000) });
  await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(now - 180_000) });
  await insertTelemetrySample({ label: 'LEAN_LEFT', angle: 12, at: new Date(now - 120_000) });
  await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2, at: new Date(now - 60_000) });
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

describe('History API', () => {
  it('paginates stored telemetry in descending order by default', async () => {
    await seedFiveSamples();

    const page1 = await request(app).get('/api/v1/history?limit=2&page=1').expect(200);

    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const first = new Date(page1.body.data.items[0].timestamp).getTime();
    const second = new Date(page1.body.data.items[1].timestamp).getTime();
    expect(first).toBeGreaterThan(second);

    const page3 = await request(app).get('/api/v1/history?limit=2&page=3').expect(200);
    expect(page3.body.data.items).toHaveLength(1);
    expect(page3.body.data.meta.hasNextPage).toBe(false);
    expect(page3.body.data.meta.hasPreviousPage).toBe(true);
  });

  it('supports ascending order and posture filtering', async () => {
    await seedFiveSamples();

    const ascending = await request(app).get('/api/v1/history?sort=asc&limit=5').expect(200);
    const timestamps = ascending.body.data.items.map((item: { timestamp: string }) =>
      new Date(item.timestamp).getTime(),
    );
    expect(timestamps[0]).toBeLessThan(timestamps[timestamps.length - 1]);

    const good = await request(app).get('/api/v1/history?posture=GOOD_POSTURE').expect(200);
    expect(good.body.data.meta.total).toBe(3);
    expect(
      good.body.data.items.every((item: { posture: { label: string } }) => item.posture.label === 'GOOD_POSTURE'),
    ).toBe(true);

    const byDevice = await request(app).get(`/api/v1/history?deviceId=${TEST_DEVICE_ID}`).expect(200);
    expect(byDevice.body.data.meta.total).toBe(5);

    const otherDevice = await request(app).get('/api/v1/history?deviceId=some-other-device').expect(200);
    expect(otherDevice.body.data.meta.total).toBe(0);
  });

  it('rejects an inverted date range', async () => {
    const response = await request(app)
      .get('/api/v1/history?from=2026-10-17T10:00:00.000Z&to=2026-10-16T10:00:00.000Z')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a single telemetry record by id', async () => {
    const created = await insertTelemetrySample({
      label: 'LEAN_RIGHT',
      angle: 9.5,
      at: new Date(Date.now() - 1000),
    });

    const response = await request(app).get(`/api/v1/history/${String(created._id)}`).expect(200);

    expect(response.body.data.id).toBe(String(created._id));
    expect(response.body.data.posture.label).toBe('LEAN_RIGHT');
  });

  it('answers 404 for an unknown telemetry id', async () => {
    const response = await request(app).get('/api/v1/history/0123456789abcdef01234567').expect(404);

    expect(response.body.error.code).toBe('TELEMETRY_NOT_FOUND');
  });
});
