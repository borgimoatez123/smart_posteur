import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
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

describe('Dashboard API', () => {
  it('returns an explicit empty state instead of fabricated values', async () => {
    const response = await request(app).get('/api/v1/dashboard/summary?period=day').expect(200);

    expect(response.body.data.hasData).toBe(false);
    expect(response.body.data.totals.measurements).toBe(0);
    expect(response.body.data.totals.goodPosturePercentage).toBe(0);
    expect(response.body.data.totals.averageAngle).toBeNull();
    expect(response.body.data.postureDistribution).toEqual([]);
    expect(response.body.data.trends).toHaveLength(24);
    expect(response.body.data.message).toContain('No posture measurements');
  });

  it('reports that no telemetry has been received yet for the current posture', async () => {
    const response = await request(app).get('/api/v1/dashboard/current').expect(200);

    expect(response.body.data.available).toBe(false);
    expect(response.body.data.posture).toBeNull();
    expect(response.body.data.deviceStatus).toBe('unknown');
    expect(response.body.data.message).toContain('No telemetry');
  });

  it('aggregates real stored telemetry into period totals', async () => {
    const now = Date.now();
    await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2.5, at: new Date(now - 8000) });
    await insertTelemetrySample({ label: 'GOOD_POSTURE', angle: 2.5, at: new Date(now - 6000) });
    await insertTelemetrySample({ label: 'SLOUCHING', angle: 17.5, at: new Date(now - 4000) });
    await insertTelemetrySample({ label: 'SLOUCHING', angle: 17.5, at: new Date(now - 2000) });

    const response = await request(app)
      .get(`/api/v1/dashboard/summary?period=day&deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    const { totals, postureDistribution, trends } = response.body.data;
    expect(response.body.data.hasData).toBe(true);

    // Durations come from real timestamp deltas (2s apart, capped by SESSION_MAX_GAP_SECONDS),
    // never from counting one sample as one second.
    expect(totals.measurements).toBe(4);
    expect(totals.goodDurationSeconds).toBe(4);
    expect(totals.badDurationSeconds).toBe(2);
    expect(totals.monitoredDurationSeconds).toBe(6);
    expect(totals.goodPosturePercentage).toBe(66.67);
    expect(totals.incorrectPostureEvents).toBe(1);
    expect(totals.averageAngle).toBe(10);

    const good = postureDistribution.find((entry: { label: string }) => entry.label === 'GOOD_POSTURE');
    const slouching = postureDistribution.find((entry: { label: string }) => entry.label === 'SLOUCHING');
    expect(good.count).toBe(2);
    expect(good.percentage).toBe(50);
    expect(slouching.count).toBe(2);

    const bucketedMeasurements = trends.reduce(
      (sum: number, bucket: { measurements: number }) => sum + bucket.measurements,
      0,
    );
    expect(bucketedMeasurements).toBe(4);
  });

  it('combines the latest posture and the daily summary in one response', async () => {
    await insertTelemetrySample({
      label: 'HEAD_FORWARD',
      angle: 24.2,
      at: new Date(Date.now() - 1000),
      alert: true,
    });

    const response = await request(app).get('/api/v1/dashboard').expect(200);

    expect(response.body.data.current.available).toBe(true);
    expect(response.body.data.current.posture).toBe('HEAD_FORWARD');
    expect(response.body.data.current.alert).toBe(true);
    expect(response.body.data.summary.hasData).toBe(true);
    expect(response.body.data.summary.totals.measurements).toBe(1);
  });
});
