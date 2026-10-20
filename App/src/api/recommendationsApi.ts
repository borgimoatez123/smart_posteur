import { DEVICE_ID, LIVE_AI_WINDOW_MINUTES } from '../config/appConfig';
import { ApiError, apiRequest } from './client';
import { endpoints } from './endpoints';
import type { DashboardPeriod, LiveRecommendationView, RecommendationView } from './types';

/**
 * `POST /api/v1/ai/recommendations`
 *
 * `refresh: true` bypasses the server cache and must only be used when the user
 * explicitly asks for a fresh analysis.
 */
export function generateRecommendation(
  period: DashboardPeriod,
  options: { refresh?: boolean; deviceId?: string; signal?: AbortSignal } = {},
): Promise<RecommendationView> {
  const { refresh = false, deviceId = DEVICE_ID, signal } = options;
  return apiRequest<RecommendationView>(endpoints.recommendations, {
    method: 'POST',
    body: { period, deviceId, refresh },
    signal,
    timeoutMs: 30_000,
  });
}

/** `GET /api/v1/ai/recommendations/latest?period=...&deviceId=...` */
export function getLatestRecommendation(
  period: DashboardPeriod,
  deviceId: string = DEVICE_ID,
  signal?: AbortSignal,
): Promise<RecommendationView> {
  return apiRequest<RecommendationView>(endpoints.latestRecommendation, {
    query: { period, deviceId },
    signal,
  });
}

/**
 * `GET /api/v1/ai/recommendations/live?deviceId=...&windowMinutes=...`
 *
 * Returns HTTP 200 for every documented state, including "no telemetry in the
 * window" (`available: false`, `source: 'none'`). Callers must therefore read
 * the response fields instead of treating a resolved promise as proof that live
 * telemetry exists.
 *
 * The timeout is longer than the default because a cache miss makes the backend
 * call Gemini; it never exceeds the historical POST timeout.
 */
export function getLiveRecommendation(
  deviceId: string = DEVICE_ID,
  windowMinutes: number = LIVE_AI_WINDOW_MINUTES,
  signal?: AbortSignal,
): Promise<LiveRecommendationView> {
  // The backend accepts an integer between 1 and 120. An out-of-contract value
  // is rejected here instead of being silently dropped, so the requested window
  // is never quietly replaced by the default one.
  if (!Number.isInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 120) {
    return Promise.reject(
      new ApiError({
        code: 'VALIDATION_ERROR',
        message: `windowMinutes must be an integer between 1 and 120 (received ${windowMinutes}).`,
      }),
    );
  }

  return apiRequest<LiveRecommendationView>(endpoints.liveRecommendation, {
    query: { deviceId, windowMinutes },
    signal,
    timeoutMs: 20_000,
  });
}
