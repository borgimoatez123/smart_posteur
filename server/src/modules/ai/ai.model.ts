import { Schema, model, type InferSchemaType } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export const RECOMMENDATION_PERIODS = ['day', 'week', 'month'] as const;
export const RECOMMENDATION_STATUSES = ['success', 'error', 'unavailable'] as const;
export const RECOMMENDATION_PRIORITIES = ['low', 'medium', 'high'] as const;

const recommendationItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    detail: { type: String, required: true, trim: true, maxlength: 1000 },
    priority: { type: String, enum: RECOMMENDATION_PRIORITIES, required: true },
  },
  { _id: false },
);

const recommendationSchema = new Schema(
  {
    period: { type: String, enum: RECOMMENDATION_PERIODS, required: true },
    deviceId: { type: String, default: null },
    generatedAt: { type: Date, default: () => new Date() },
    statisticsSnapshot: { type: Schema.Types.Mixed, required: true },
    summary: { type: String, default: null },
    recommendations: { type: [recommendationItemSchema], default: [] },
    model: { type: String, required: true },
    status: { type: String, enum: RECOMMENDATION_STATUSES, required: true },
    error: { type: String, default: null },
    /** Hash of the statistics snapshot: identical statistics reuse the result. */
    cacheKey: { type: String, required: true, unique: true },
  },
  { versionKey: false },
);

recommendationSchema.index({ generatedAt: -1 });
recommendationSchema.index({ period: 1, deviceId: 1, generatedAt: -1 });
/**
 * Retention, NOT cache expiry. A stored recommendation used to be deleted after
 * `AI_CACHE_TTL_SECONDS` (5 minutes by default), which made
 * `GET /ai/recommendations/latest` answer 404 a few minutes after a perfectly
 * successful generation. Freshness is now decided by the explicit cache window
 * in the service; this index only bounds how long the documents are kept.
 */
recommendationSchema.index(
  { generatedAt: 1 },
  { expireAfterSeconds: env.AI_RECOMMENDATION_TTL_SECONDS, name: 'recommendation_retention_ttl' },
);

export type RecommendationAttributes = InferSchemaType<typeof recommendationSchema>;
export const Recommendation = model('Recommendation', recommendationSchema);

/** Name of the short-lived cache index created by earlier versions. */
const LEGACY_CACHE_INDEX = 'recommendation_cache_ttl';

/**
 * Drops the legacy 5-minute TTL index (if it still exists) and applies the
 * current index definitions. Index options cannot be altered in place, so the
 * old index has to be removed before the retention index can take effect on an
 * existing database.
 */
export async function syncRecommendationIndexes(): Promise<void> {
  try {
    await Recommendation.collection.dropIndex(LEGACY_CACHE_INDEX);
    logger.info({ index: LEGACY_CACHE_INDEX }, 'Dropped the legacy recommendation cache TTL index');
  } catch {
    // The index is already gone: this is the normal case on a fresh database.
  }
  await Recommendation.syncIndexes();
}
