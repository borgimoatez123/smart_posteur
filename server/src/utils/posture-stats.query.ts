import { Telemetry } from '../modules/telemetry/telemetry.model';
import { computePostureStats, type PostureSample, type PostureStats } from './posture-stats';
import type { PostureLabel } from '../shared/domain';
import { logger } from './logger';

export interface PostureRangeQuery {
  deviceId?: string;
  from: Date;
  to: Date;
  maxGapSeconds: number;
  limit: number;
}

/**
 * Loads the telemetry of a time window and derives posture statistics from it.
 *
 * The samples are projected down to `timestamp`, `posture.label` and
 * `posture.angle`: only what statistics need is transferred from MongoDB.
 */
export async function calculatePostureStatsForRange(query: PostureRangeQuery): Promise<PostureStats> {
  const filter: Record<string, unknown> = { timestamp: { $gte: query.from, $lte: query.to } };
  if (query.deviceId) {
    filter.deviceId = query.deviceId;
  }

  const documents = await Telemetry.find(filter)
    .sort({ timestamp: 1 })
    .select('timestamp posture')
    .limit(query.limit)
    .lean();

  const samples: PostureSample[] = documents.map((document) => ({
    timestamp: document.timestamp as Date,
    label: document.posture.label as PostureLabel,
    angle: document.posture.angle ?? null,
  }));

  if (documents.length === query.limit) {
    logger.warn(
      { limit: query.limit, deviceId: query.deviceId ?? null },
      'Statistics window reached the sample limit; results may be truncated',
    );
  }

  return computePostureStats(samples, { maxGapSeconds: query.maxGapSeconds });
}
