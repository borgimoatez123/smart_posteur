import { z } from 'zod';
import { deviceIdSchema } from '../../utils/validation';
import { RECOMMENDATION_PERIODS } from './ai.model';

export const recommendationPeriodSchema = z.enum(RECOMMENDATION_PERIODS);

export const createRecommendationBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    period: recommendationPeriodSchema.default('day'),
    deviceId: deviceIdSchema.optional(),
    /** Bypass the cache and call Gemini again for the same statistics. */
    refresh: z.boolean().optional().default(false),
  }),
);

export type CreateRecommendationBody = z.infer<typeof createRecommendationBodySchema>;

export const latestRecommendationQuerySchema = z.object({
  period: recommendationPeriodSchema.default('day'),
  deviceId: deviceIdSchema.optional(),
});

export type LatestRecommendationQuery = z.infer<typeof latestRecommendationQuerySchema>;

/** Rolling window (minutes) analysed by the live endpoint; defaults to the server config. */
export const liveRecommendationQuerySchema = z.object({
  deviceId: deviceIdSchema.optional(),
  windowMinutes: z.coerce.number().int().min(1).max(120).optional(),
});

export type LiveRecommendationQuery = z.infer<typeof liveRecommendationQuerySchema>;
