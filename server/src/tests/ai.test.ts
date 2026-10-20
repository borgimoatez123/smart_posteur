import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';
import { Recommendation } from '../modules/ai/ai.model';
import { clearLiveCache } from '../modules/ai/ai.service';
import type { PostureLabel } from '../shared/domain';
import {
  clearDatabase,
  reconnectTestDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  TEST_DEVICE_ID,
} from './helpers/test-db';
import { insertTelemetrySample } from './helpers/fixtures';

const { createInteraction } = vi.hoisted(() => ({ createInteraction: vi.fn() }));

// The Gemini SDK is mocked so the success path is covered without network calls.
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    interactions = { create: createInteraction };
  },
}));

const app = createApp();

const GEMINI_PAYLOAD = {
  summary: 'You spent most of the period in good posture, with recurring slouching.',
  recommendations: [
    {
      title: 'Raise your monitor',
      detail: 'Place the top of the screen at eye level to reduce forward head posture.',
      priority: 'high',
    },
  ],
};

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  clearLiveCache();
});

afterEach(() => {
  env.GEMINI_API_KEY = undefined;
  createInteraction.mockReset();
});

describe('AI recommendations API', () => {
  it('refuses to generate a recommendation when the period has no posture data', async () => {
    const response = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'day' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NO_POSTURE_DATA');
  });

  it('degrades gracefully when GEMINI_API_KEY is not configured', async () => {
    await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(Date.now() - 1000) });

    const response = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'day', deviceId: TEST_DEVICE_ID })
      .expect(503);

    expect(response.body.error.code).toBe('GEMINI_NOT_CONFIGURED');
    expect(response.body.message).toContain('GEMINI_API_KEY');

    // The failed attempt is recorded as unavailable and never as a cached success.
    const stored = await Recommendation.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('unavailable');
    expect(stored[0].error).toContain('GEMINI_API_KEY');
  });

  it('rejects an unsupported period', async () => {
    const response = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'year' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body.error.details)).toContain('period');
  });

  it('has no latest recommendation to return before a successful generation', async () => {
    const response = await request(app)
      .get('/api/v1/ai/recommendations/latest?period=day')
      .expect(404);

    expect(response.body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
  });

  it('generates a recommendation and serves the repeat request from the cache', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_1',
      status: 'completed',
      output_text: JSON.stringify(GEMINI_PAYLOAD),
    });

    await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(Date.now() - 1000) });

    const first = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'day', deviceId: TEST_DEVICE_ID })
      .expect(200);

    expect(first.body.message).toBe('Recommendation generated');
    expect(first.body.data.cached).toBe(false);
    expect(first.body.data.summary).toBe(GEMINI_PAYLOAD.summary);
    expect(first.body.data.recommendations).toHaveLength(1);
    expect(first.body.data.recommendations[0].priority).toBe('high');
    expect(first.body.data.model).toBe(env.GEMINI_MODEL);
    expect(first.body.data.disclaimer).toBeTruthy();
    expect(createInteraction).toHaveBeenCalledTimes(1);

    // Identical statistics must reuse the stored result instead of calling Gemini again.
    const second = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'day', deviceId: TEST_DEVICE_ID })
      .expect(200);

    expect(second.body.message).toBe('Recommendation served from cache');
    expect(second.body.data.cached).toBe(true);
    expect(createInteraction).toHaveBeenCalledTimes(1);

    const stored = await Recommendation.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('success');
  });

  it('maps a Gemini failure to a BAD_GATEWAY and records it as an error', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockRejectedValue(new Error('upstream exploded'));

    await insertTelemetrySample({ label: 'SLOUCHING', angle: 18, at: new Date(Date.now() - 1000) });

    const response = await request(app)
      .post('/api/v1/ai/recommendations')
      .send({ period: 'day', deviceId: TEST_DEVICE_ID })
      .expect(502);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_GATEWAY');

    const stored = await Recommendation.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('error');
  });

  it('keeps serving the latest recommendation after the cache window elapsed', async () => {
    // Regression: the model used to TTL-expire every stored recommendation after
    // AI_CACHE_TTL_SECONDS, so `/latest` answered 404 minutes after a success.
    const generatedAt = new Date(Date.now() - (env.AI_CACHE_TTL_SECONDS + 600) * 1000);
    await Recommendation.create({
      period: 'day',
      deviceId: TEST_DEVICE_ID,
      generatedAt,
      statisticsSnapshot: { totals: { measurements: 10 } },
      summary: 'Historic recommendation',
      recommendations: [{ title: 'Sit up', detail: 'Straighten your back a little.', priority: 'medium' }],
      model: env.GEMINI_MODEL,
      status: 'success',
      error: null,
      cacheKey: 'historic-cache-key',
    });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/latest?period=day&deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.summary).toBe('Historic recommendation');
    expect(response.body.data.generatedAt).toBe(generatedAt.toISOString());
  });
});

const LIVE_GEMINI_PAYLOAD = {
  title: 'Sit back and lower your shoulders',
  immediateAction: 'Roll your shoulders back and lift your chest until your ears sit above them.',
  futureImpact: 'Practising this a few times an hour may help you build a more comfortable habit.',
  priority: 'high',
  reason: 'Slouching was the most frequent label across the measurements in this window.',
};

/**
 * Structurally valid but far too long to be a coaching card: the backend must
 * fall back to the deterministic template instead of showing a wall of text.
 */
const VERBOSE_LIVE_PAYLOAD = {
  title: 'Slouching detected repeatedly across the analysed window',
  immediateAction:
    'Sit or stand a little taller right now and gently bring your torso back into a comfortable neutral position while you relax your shoulders and let your breath settle and keep your feet flat and your screen at a comfortable height and take a short break and move around a little and then return to a comfortable position and notice how your back feels and keep going with small corrections.',
  futureImpact: 'Practising small corrections may help you build greater awareness of your posture.',
  priority: 'medium',
  reason: 'Slouching was the most frequent label in this window.',
};

const OTHER_DEVICE_ID = 'other-belt-99';

/**
 * Inserts `count` samples of the same posture, newest first, relative to now.
 * The default spread keeps every sample inside the 10 minute live window while
 * the newest one stays well under AI_LIVE_STALE_SECONDS.
 */
async function insertRun(
  label: PostureLabel,
  count: number,
  options: { ageSeconds?: number; stepSeconds?: number; deviceId?: string; angle?: number } = {},
): Promise<void> {
  const base = Date.now();
  const ageSeconds = options.ageSeconds ?? 5;
  const stepSeconds = options.stepSeconds ?? 2;
  for (let index = 0; index < count; index += 1) {
    await insertTelemetrySample({
      label,
      angle: options.angle ?? 22,
      at: new Date(base - (ageSeconds + index * stepSeconds) * 1000),
      deviceId: options.deviceId,
    });
  }
}

describe('Live AI recommendations API', () => {
  it('always answers 200 with no recent telemetry instead of an error', async () => {
    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.available).toBe(false);
    expect(response.body.data.dataQuality).toBe('none');
    expect(response.body.data.sampleCount).toBe(0);
    expect(response.body.data.advice).toBeNull();
    expect(response.body.data.source).toBe('none');
    expect(response.body.data.current).toBeNull();
  });

  it('reports limited data quality when only one measurement exists', async () => {
    await insertRun('SLOUCHING', 1, { ageSeconds: 5 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.available).toBe(true);
    expect(response.body.data.sampleCount).toBe(1);
    expect(response.body.data.dataQuality).toBe('limited');
    expect(response.body.data.current.posture).toBe('SLOUCHING');
    expect(response.body.data.advice.title).toBe('Give your back a gentle reset');
    expect(response.body.data.advice.priority).toBe('medium');
    expect(response.body.data.advice.reason).toContain('rough impression');
  });

  it('falls back to the posture template when Gemini is not configured', async () => {
    await insertRun('SLOUCHING', 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.source).toBe('fallback');
    expect(response.body.data.model).toBeNull();
    expect(response.body.data.aiConfigured).toBe(false);
    expect(response.body.data.dataQuality).toBe('recent');
    expect(response.body.data.dominantPosture).toBe('SLOUCHING');
    expect(response.body.data.summary).toContain('forward slouching');
    expect(response.body.data.advice.reason).toContain('Slouching');
    expect(createInteraction).not.toHaveBeenCalled();
    // Live advice is never persisted as a historical recommendation.
    expect(await Recommendation.countDocuments({})).toBe(0);
  });

  it('encourages the user to keep a good posture', async () => {
    await insertRun('GOOD_POSTURE', 8);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.dominantPosture).toBe('GOOD_POSTURE');
    expect(response.body.data.advice.title).toBe("You're building a good habit");
    expect(response.body.data.advice.priority).toBe('low');
    expect(response.body.data.goodPosturePercentage).toBe(100);
  });

  const LEANING_CASES = [
    ['LEAN_LEFT', 'Bring your posture back to center'],
    ['LEAN_RIGHT', 'Find your center again'],
    ['HEAD_FORWARD', 'Bring your head back into alignment'],
  ] as const;

  it.each(LEANING_CASES)('coaches the %s posture', async (label, expectedTitle) => {
    await insertRun(label, 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.dominantPosture).toBe(label);
    expect(response.body.data.advice.title).toBe(expectedTitle);
    expect(response.body.data.advice.futureImpact).toMatch(/habit|alignment/i);
  });

  it('uses the dominant recent posture rather than a single noisy reading', async () => {
    await insertRun('GOOD_POSTURE', 2, { ageSeconds: 3 });
    await insertRun('SLOUCHING', 8, { ageSeconds: 30 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.sampleCount).toBe(10);
    expect(response.body.data.dominantPosture).toBe('SLOUCHING');
    expect(response.body.data.postureDistribution).toHaveLength(2);
    expect(response.body.data.postureChanges).toBeGreaterThanOrEqual(1);
  });

  it('marks old telemetry as stale instead of pretending the device is live', async () => {
    await insertRun('SLOUCHING', 6, { ageSeconds: 600 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}&windowMinutes=60`)
      .expect(200);

    expect(response.body.data.stale).toBe(true);
    expect(response.body.data.source).toBe('fallback');
    expect(response.body.message).toContain('stale');
    expect(createInteraction).not.toHaveBeenCalled();
  });

  it('reports established data quality for a dense, long window', async () => {
    await insertRun('GOOD_POSTURE', 60, { ageSeconds: 5, stepSeconds: 6 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.sampleCount).toBe(60);
    expect(response.body.data.dataQuality).toBe('established');
    expect(response.body.data.observedFrom).toBeTruthy();
    expect(response.body.data.observedTo).toBeTruthy();
  });

  it('keeps devices isolated from each other', async () => {
    await insertRun('SLOUCHING', 6, { deviceId: TEST_DEVICE_ID });
    await insertRun('GOOD_POSTURE', 6, { deviceId: OTHER_DEVICE_ID, ageSeconds: 2 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.deviceId).toBe(TEST_DEVICE_ID);
    expect(response.body.data.sampleCount).toBe(6);
    expect(response.body.data.dominantPosture).toBe('SLOUCHING');
  });

  it('personalises the advice with Gemini and then reuses it while the context is unchanged', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_1',
      status: 'completed',
      output_text: JSON.stringify(LIVE_GEMINI_PAYLOAD),
    });
    await insertRun('SLOUCHING', 6);

    const first = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(first.body.message).toBe('Live coaching generated for the current posture.');
    expect(first.body.data.source).toBe('gemini');
    expect(first.body.data.model).toBe(env.GEMINI_MODEL);
    expect(first.body.data.cached).toBe(false);
    // The factual frame stays backend-computed; only the coaching is model-written.
    expect(first.body.data.summary).toContain('forward slouching');
    expect(first.body.data.advice.title).toBe(LIVE_GEMINI_PAYLOAD.title);
    expect(first.body.data.advice.priority).toBe('high');
    expect(first.body.data.advice.reason).toBe(LIVE_GEMINI_PAYLOAD.reason);
    expect(createInteraction).toHaveBeenCalledTimes(1);

    const second = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(second.body.message).toBe(
      'Live coaching reused: the recent context has not changed materially.',
    );
    expect(second.body.data.cached).toBe(true);
    expect(second.body.data.advice.title).toBe(LIVE_GEMINI_PAYLOAD.title);
    expect(createInteraction).toHaveBeenCalledTimes(1);
    expect(await Recommendation.countDocuments({})).toBe(0);
  });

  it('falls back to the posture template when Gemini fails', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockRejectedValue(new Error('upstream exploded'));
    await insertRun('HEAD_FORWARD', 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.source).toBe('fallback');
    expect(response.body.data.advice.title).toBe('Bring your head back into alignment');
    expect(response.body.data.advice.reason).toBeTruthy();
    expect(response.body.message).toContain('did not return usable coaching');
  });

  it('falls back to the posture template when Gemini returns unusable JSON', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_bad',
      status: 'completed',
      output_text: JSON.stringify({ title: 'Too short' }),
    });
    await insertRun('SLOUCHING', 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.source).toBe('fallback');
    expect(response.body.data.advice.title).toBe('Give your back a gentle reset');
  });

  it('ignores an over-long Gemini answer and serves the template instead', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_verbose',
      status: 'completed',
      output_text: JSON.stringify(VERBOSE_LIVE_PAYLOAD),
    });
    await insertRun('SLOUCHING', 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.source).toBe('fallback');
    expect(response.body.data.advice.title).toBe('Give your back a gentle reset');
    expect(response.body.message).toContain('did not return usable coaching');
  });

  it('raises the priority when the incorrect posture persists', async () => {
    await insertRun('SLOUCHING', 20, { stepSeconds: 2 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.persistentIncorrectSeconds).toBeGreaterThanOrEqual(30);
    expect(response.body.data.advice.priority).toBe('high');
    expect(response.body.data.advice.reason).toContain('held for');
  });

  it('never lets Gemini downplay a persistent incorrect posture', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_low',
      status: 'completed',
      output_text: JSON.stringify({ ...LIVE_GEMINI_PAYLOAD, priority: 'low' }),
    });
    await insertRun('SLOUCHING', 20, { stepSeconds: 2 });

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.source).toBe('gemini');
    // The telemetry justifies "high"; the model may not lower it.
    expect(response.body.data.advice.priority).toBe('high');
  });

  it('asks for a clearer reading when the window cannot be classified', async () => {
    await insertRun('UNKNOWN', 6);

    const response = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(response.body.data.dominantPosture).toBe('UNKNOWN');
    expect(response.body.data.current.posture).toBe('UNKNOWN');
    expect(response.body.data.advice.title).toBe("Let's get a clearer reading");
    expect(response.body.data.advice.priority).toBe('low');
    // An unclassified reading is never counted as good or bad posture.
    expect(response.body.data.goodPosturePercentage).toBe(0);
    expect(response.body.data.monitoredDurationSeconds).toBe(0);
    expect(response.body.data.incorrectPostureEvents).toBe(0);
  });

  it('does not call Gemini again when extra measurements leave the context unchanged', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_stable',
      status: 'completed',
      output_text: JSON.stringify(LIVE_GEMINI_PAYLOAD),
    });
    await insertRun('SLOUCHING', 6);

    await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);
    expect(createInteraction).toHaveBeenCalledTimes(1);

    // Six older measurements of the same posture: same situation, newer numbers.
    await insertRun('SLOUCHING', 6, { ageSeconds: 20 });

    const second = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(createInteraction).toHaveBeenCalledTimes(1);
    expect(second.body.data.cached).toBe(true);
    // The numbers stay current even while the wording is reused.
    expect(second.body.data.sampleCount).toBe(12);
  });

  it('refreshes the coaching when the posture changes', async () => {
    env.GEMINI_API_KEY = 'test-key';
    createInteraction.mockResolvedValue({
      id: 'interaction_live_change',
      status: 'completed',
      output_text: JSON.stringify(LIVE_GEMINI_PAYLOAD),
    });
    await insertRun('SLOUCHING', 6);

    await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);
    expect(createInteraction).toHaveBeenCalledTimes(1);

    // A newer good-posture reading changes the coaching context.
    await insertRun('GOOD_POSTURE', 3, { ageSeconds: 2, stepSeconds: 1 });

    const second = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
      .expect(200);

    expect(second.body.data.current.posture).toBe('GOOD_POSTURE');
    expect(second.body.data.cached).toBe(false);
    expect(createInteraction).toHaveBeenCalledTimes(2);
  });

  it('rejects an out-of-range window', async () => {
    const tooSmall = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}&windowMinutes=0`)
      .expect(400);
    expect(tooSmall.body.error.code).toBe('VALIDATION_ERROR');

    const tooLarge = await request(app)
      .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}&windowMinutes=999`)
      .expect(400);
    expect(tooLarge.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reports an explicit server error when MongoDB is unavailable', async () => {
    await mongoose.disconnect();
    try {
      const response = await request(app)
        .get(`/api/v1/ai/recommendations/live?deviceId=${TEST_DEVICE_ID}`)
        .expect(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    } finally {
      await reconnectTestDatabase();
    }
  });
});
