import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import * as aiService from './ai.service';
import type {
  CreateRecommendationBody,
  LatestRecommendationQuery,
  LiveRecommendationQuery,
} from './ai.validation';

export const postRecommendations: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as CreateRecommendationBody;
  const recommendation = await aiService.generateRecommendations({
    period: body.period,
    deviceId: body.deviceId ?? null,
    refresh: body.refresh,
  });

  return sendSuccess(
    res,
    recommendation,
    recommendation.cached ? 'Recommendation served from cache' : 'Recommendation generated',
  );
});

export const getLatestRecommendation: RequestHandler = asyncHandler(async (req, res) => {
  const { period, deviceId } = req.query as unknown as LatestRecommendationQuery;
  const recommendation = await aiService.getLatestRecommendation(period, deviceId ?? null);
  return sendSuccess(res, recommendation);
});

/**
 * Live advice is always HTTP 200: a missing device, stale telemetry or an
 * unavailable Gemini key all produce a documented state, never an error page.
 */
export const getLiveRecommendation: RequestHandler = asyncHandler(async (req, res) => {
  const { deviceId, windowMinutes } = req.query as unknown as LiveRecommendationQuery;
  const live = await aiService.generateLiveRecommendation({
    deviceId: deviceId ?? null,
    windowMinutes,
  });
  return sendSuccess(res, live, live.message);
});
