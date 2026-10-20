import { createHash } from 'node:crypto';
import { Recommendation } from './ai.model';
import { Telemetry } from '../telemetry/telemetry.model';
import { getSummary } from '../dashboard/dashboard.service';
import type { DashboardPeriod } from '../dashboard/dashboard.service';
import { AppError } from '../../utils/http-error';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { computePostureStats, type PostureSample } from '../../utils/posture-stats';
import { roundTo } from '../../utils/validation';
import { POSTURE_LABELS, isBadPosture, type PostureLabel } from '../../shared/domain';
import {
  COACHING_THRESHOLDS,
  coachingAdviceFor,
  describePosture,
  maxPriority,
  type CoachingAdvice,
  type CoachingContext,
  type CoachingPriority,
} from './ai.coaching';
import {
  DISCLAIMER,
  isGeminiConfigured,
  isLiveAdviceUsable,
  requestLiveAdvice,
  requestRecommendations,
  type GeminiRecommendation,
} from './gemini.client';

export interface StatisticsSnapshot {
  period: DashboardPeriod;
  deviceId: string | null;
  range: { from: string; to: string };
  totals: {
    measurements: number;
    incorrectPostureEvents: number;
    goodDurationSeconds: number;
    badDurationSeconds: number;
    monitoredDurationSeconds: number;
    goodPosturePercentage: number;
    averageAngle: number | null;
  };
  postureDistribution: { label: string; count: number; percentage: number }[];
  trends: {
    label: string;
    measurements: number;
    incorrectPostureEvents: number;
    goodPosturePercentage: number;
    badDurationSeconds: number;
  }[];
  hasData: boolean;
}

/**
 * Only aggregated statistics are sent to Gemini: never the raw telemetry stream
 * and never anything that could identify a person.
 */
export async function buildStatisticsSnapshot(
  period: DashboardPeriod,
  deviceId: string | null,
): Promise<StatisticsSnapshot> {
  const summary = await getSummary(period, deviceId);
  return {
    period: summary.period,
    deviceId: summary.deviceId,
    range: summary.range,
    totals: summary.totals,
    postureDistribution: summary.postureDistribution.map((entry) => ({
      label: entry.label,
      count: entry.count,
      percentage: entry.percentage,
    })),
    trends: summary.trends.map((bucket) => ({
      label: bucket.label,
      measurements: bucket.measurements,
      incorrectPostureEvents: bucket.incorrectPostureEvents,
      goodPosturePercentage: bucket.goodPosturePercentage,
      badDurationSeconds: bucket.badDurationSeconds,
    })),
    hasData: summary.hasData,
  };
}

/**
 * Stable cache key: the moving parts of the snapshot (`generatedAt`, the range
 * end timestamp) are excluded so identical statistics reuse one Gemini call.
 */
function buildCacheKey(snapshot: StatisticsSnapshot): string {
  const stablePayload = {
    period: snapshot.period,
    deviceId: snapshot.deviceId,
    totals: snapshot.totals,
    postureDistribution: snapshot.postureDistribution,
    trends: snapshot.trends,
  };
  return createHash('sha256').update(JSON.stringify(stablePayload)).digest('hex');
}

export interface RecommendationView {
  id: string;
  period: DashboardPeriod;
  deviceId: string | null;
  generatedAt: string;
  summary: string | null;
  recommendations: GeminiRecommendation['recommendations'];
  model: string;
  status: 'success' | 'error' | 'unavailable';
  error: string | null;
  cached: boolean;
  aiConfigured: boolean;
  disclaimer: string;
}

type RecommendationLike = {
  _id: unknown;
  period: string;
  deviceId?: string | null;
  generatedAt?: Date | null;
  summary?: string | null;
  recommendations?: GeminiRecommendation['recommendations'] | null;
  model: string;
  status: string;
  error?: string | null;
};

function toView(document: RecommendationLike, cached: boolean): RecommendationView {
  return {
    id: String(document._id),
    period: document.period as DashboardPeriod,
    deviceId: document.deviceId ?? null,
    generatedAt: (document.generatedAt ?? new Date()).toISOString(),
    summary: document.summary ?? null,
    recommendations: document.recommendations ?? [],
    model: document.model,
    status: document.status as RecommendationView['status'],
    error: document.error ?? null,
    cached,
    aiConfigured: isGeminiConfigured(),
    disclaimer: DISCLAIMER,
  };
}

export interface GenerateRecommendationsInput {
  period: DashboardPeriod;
  deviceId?: string | null;
  refresh?: boolean;
}

export async function generateRecommendations(
  input: GenerateRecommendationsInput,
): Promise<RecommendationView> {
  const deviceId = input.deviceId ?? null;
  const snapshot = await buildStatisticsSnapshot(input.period, deviceId);

  if (!snapshot.hasData || snapshot.totals.measurements === 0) {
    throw AppError.badRequest(
      'No posture measurements are available for this period, so no recommendation can be generated',
      { period: input.period, deviceId },
      'NO_POSTURE_DATA',
    );
  }

  const cacheKey = buildCacheKey(snapshot);

  if (!input.refresh) {
    // The cache window is explicit: a stored document older than
    // AI_CACHE_TTL_SECONDS is still returned by `/latest`, but it no longer
    // suppresses a fresh Gemini call for the same statistics.
    const cachedDocument = await Recommendation.findOne({
      cacheKey,
      status: 'success',
      generatedAt: { $gte: new Date(Date.now() - env.AI_CACHE_TTL_SECONDS * 1000) },
    })
      .sort({ generatedAt: -1 })
      .lean();
    if (cachedDocument) {
      return toView(cachedDocument as RecommendationLike, true);
    }
  }

  try {
    const { model, result } = await requestRecommendations(snapshot);

    const document = await Recommendation.create({
      period: input.period,
      deviceId,
      generatedAt: new Date(),
      statisticsSnapshot: snapshot,
      summary: result.summary,
      recommendations: result.recommendations,
      model,
      status: 'success',
      error: null,
      cacheKey,
    });

    return toView(document.toObject() as RecommendationLike, false);
  } catch (error) {
    const appError =
      error instanceof AppError ? error : AppError.badGateway('Gemini request failed unexpectedly');

    const status = appError.code === 'GEMINI_NOT_CONFIGURED' ? 'unavailable' : 'error';

    try {
      await Recommendation.create({
        period: input.period,
        deviceId,
        generatedAt: new Date(),
        statisticsSnapshot: snapshot,
        summary: null,
        recommendations: [],
        model: env.GEMINI_MODEL,
        status,
        error: appError.message,
        // Suffixed so a failed attempt never shadows a future successful cache entry.
        cacheKey: `${cacheKey}:${status}:${Date.now()}`,
      });
    } catch (persistError) {
      logger.error({ err: persistError }, 'Failed to record the AI recommendation failure');
    }

    throw appError;
  }
}

export async function getLatestRecommendation(
  period: DashboardPeriod,
  deviceId?: string | null,
): Promise<RecommendationView> {
  const document = await Recommendation.findOne({
    period,
    deviceId: deviceId ?? null,
    status: 'success',
  })
    .sort({ generatedAt: -1 })
    .lean();

  if (!document) {
    throw AppError.notFound(
      'No AI recommendation has been generated for this period yet',
      { period, deviceId: deviceId ?? null, aiConfigured: isGeminiConfigured() },
      'RECOMMENDATION_NOT_FOUND',
    );
  }

  return toView(document as RecommendationLike, true);
}

/* -------------------------------------------------------------------------- */
/*  Live recommendations                                                      */
/* -------------------------------------------------------------------------- */

export const LIVE_DATA_QUALITIES = ['none', 'limited', 'recent', 'established'] as const;
export type LiveDataQuality = (typeof LIVE_DATA_QUALITIES)[number];

/**
 * Turns a raw sample count into an explicit data-quality label, so the API (and
 * Gemini) can distinguish "no data" from "a few readings" from "enough for a
 * meaningful recent snapshot" from "enough for a trend". Nothing is fabricated
 * to make the numbers look denser than they are.
 */
export const LIVE_QUALITY_THRESHOLDS = {
  /** Fewer samples than this only support a rough impression. */
  limitedMaxSamples: 5,
  /** Both conditions are required before a long-term trend is claimed. */
  establishedMinSamples: 60,
  establishedMinCoverageSeconds: 300,
} as const;

interface LiveTelemetrySample extends PostureSample {
  confidence: number | null;
  alert: boolean;
}

interface LiveSnapshot {
  deviceId: string | null;
  windowMinutes: number;
  sampleCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  coverageSeconds: number;
  latestSampleAgeSeconds: number | null;
  currentPosture: PostureLabel | null;
  currentAngle: number | null;
  currentConfidence: number | null;
  currentAlert: boolean;
  dominantPosture: PostureLabel | null;
  postureDistribution: { label: PostureLabel; count: number; percentage: number }[];
  averageAngle: number | null;
  angleDelta: number | null;
  postureChanges: number;
  incorrectPostureEvents: number;
  persistentIncorrectSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  dataQuality: LiveDataQuality;
  stale: boolean;
}

async function loadLiveSamples(
  deviceId: string | null,
  from: Date,
  to: Date,
  limit: number,
): Promise<LiveTelemetrySample[]> {
  const filter: Record<string, unknown> = { timestamp: { $gte: from, $lte: to } };
  if (deviceId) {
    filter.deviceId = deviceId;
  }

  // Newest-first + limit keeps only the most recent records in memory.
  const documents = await Telemetry.find(filter)
    .sort({ timestamp: -1 })
    .select('timestamp posture alert')
    .limit(limit)
    .lean();

  if (documents.length === limit) {
    logger.warn({ deviceId, limit }, 'Live recommendation window reached the sample limit');
  }

  return documents.reverse().map((document) => ({
    timestamp: document.timestamp as Date,
    label: document.posture.label as PostureLabel,
    angle: document.posture.angle ?? null,
    confidence: document.posture.confidence ?? null,
    alert: document.alert ?? false,
  }));
}

/** Most frequent classified posture. `null` when every sample is UNKNOWN. */
function dominantLabel(samples: readonly LiveTelemetrySample[]): PostureLabel | null {
  const counts = new Map<PostureLabel, number>();
  for (const sample of samples) {
    if (sample.label === 'UNKNOWN') {
      continue;
    }
    counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1);
  }

  let best: PostureLabel | null = null;
  let bestCount = 0;
  // Iterating POSTURE_LABELS keeps ties deterministic.
  for (const label of POSTURE_LABELS) {
    const count = counts.get(label) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = label;
    }
  }
  return best;
}

function countPostureChanges(samples: readonly LiveTelemetrySample[]): number {
  let changes = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].label !== samples[index - 1].label) {
      changes += 1;
    }
  }
  return changes;
}

/**
 * Duration of the incorrect-posture run that is still in progress, derived from
 * timestamp deltas and capped by SESSION_MAX_GAP_SECONDS so an offline gap is
 * never reported as a very long slouch.
 */
function trailingIncorrectSeconds(samples: readonly LiveTelemetrySample[]): number {
  let total = 0;
  for (let index = samples.length - 1; index > 0; index -= 1) {
    const current = samples[index];
    if (!isBadPosture(current.label)) {
      break;
    }
    const deltaSeconds = (current.timestamp.getTime() - samples[index - 1].timestamp.getTime()) / 1000;
    if (deltaSeconds <= 0 || deltaSeconds > env.SESSION_MAX_GAP_SECONDS) {
      break;
    }
    total += deltaSeconds;
  }
  return roundTo(total, 2);
}

function buildLiveDistribution(
  samples: readonly LiveTelemetrySample[],
): { label: PostureLabel; count: number; percentage: number }[] {
  const counts = new Map<PostureLabel, number>();
  for (const sample of samples) {
    counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1);
  }

  return POSTURE_LABELS.filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => {
      const count = counts.get(label) ?? 0;
      return { label, count, percentage: roundTo((count / samples.length) * 100, 2) };
    })
    .sort((a, b) => b.count - a.count);
}

function classifyLiveQuality(sampleCount: number, coverageSeconds: number): LiveDataQuality {
  if (sampleCount === 0) {
    return 'none';
  }
  if (sampleCount < LIVE_QUALITY_THRESHOLDS.limitedMaxSamples) {
    return 'limited';
  }
  if (
    sampleCount >= LIVE_QUALITY_THRESHOLDS.establishedMinSamples &&
    coverageSeconds >= LIVE_QUALITY_THRESHOLDS.establishedMinCoverageSeconds
  ) {
    return 'established';
  }
  return 'recent';
}

function buildLiveSnapshot(
  samples: readonly LiveTelemetrySample[],
  input: { deviceId: string | null; windowMinutes: number; now: Date },
): LiveSnapshot {
  const stats = computePostureStats(samples, { maxGapSeconds: env.SESSION_MAX_GAP_SECONDS });
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;
  const first = samples.length > 0 ? samples[0] : null;

  const coverageSeconds =
    stats.firstSampleAt && stats.lastSampleAt
      ? roundTo((stats.lastSampleAt.getTime() - stats.firstSampleAt.getTime()) / 1000, 2)
      : 0;
  const latestSampleAgeSeconds = stats.lastSampleAt
    ? roundTo((input.now.getTime() - stats.lastSampleAt.getTime()) / 1000, 2)
    : null;

  const angleDelta =
    first && latest && typeof first.angle === 'number' && typeof latest.angle === 'number'
      ? roundTo(latest.angle - first.angle, 2)
      : null;

  const classified = dominantLabel(samples);

  return {
    deviceId: input.deviceId,
    windowMinutes: input.windowMinutes,
    sampleCount: stats.measurements,
    observedFrom: stats.firstSampleAt ? stats.firstSampleAt.toISOString() : null,
    observedTo: stats.lastSampleAt ? stats.lastSampleAt.toISOString() : null,
    coverageSeconds,
    latestSampleAgeSeconds,
    currentPosture: latest ? latest.label : null,
    currentAngle: latest ? latest.angle ?? null : null,
    currentConfidence: latest ? latest.confidence : null,
    currentAlert: latest ? latest.alert : false,
    dominantPosture: classified ?? (samples.length > 0 ? 'UNKNOWN' : null),
    postureDistribution: buildLiveDistribution(samples),
    averageAngle: stats.averageAngle,
    angleDelta,
    postureChanges: countPostureChanges(samples),
    incorrectPostureEvents: stats.incorrectPostureEvents,
    persistentIncorrectSeconds: trailingIncorrectSeconds(samples),
    monitoredDurationSeconds: stats.monitoredDurationSeconds,
    goodPosturePercentage: stats.goodPosturePercentage,
    dataQuality: classifyLiveQuality(stats.measurements, coverageSeconds),
    stale: latestSampleAgeSeconds === null || latestSampleAgeSeconds > env.AI_LIVE_STALE_SECONDS,
  };
}

/**
 * Short factual line describing what the window contains. It is always computed
 * by the backend from real aggregates and is deliberately kept to one sentence:
 * the coaching card carries the advice, this line only frames it.
 */
function buildFallbackSummary(snapshot: LiveSnapshot): string {
  const phrase = describePosture(snapshot.dominantPosture);
  const readings = `${snapshot.sampleCount} measurement${
    snapshot.sampleCount === 1 ? '' : 's'
  } in the last ${snapshot.windowMinutes} min`;
  const quality =
    snapshot.dataQuality === 'limited' ? 'a limited snapshot' : `${snapshot.dataQuality} data`;
  return `${readings} point to ${phrase} (${quality}).`;
}

/** Compact, aggregated payload: no raw sensor stream is ever sent to Gemini. */
function buildLiveAiPayload(snapshot: LiveSnapshot) {
  return {
    currentPosture: snapshot.currentPosture,
    dominantPosture: snapshot.dominantPosture,
    postureDistribution: snapshot.postureDistribution,
    averageAngle: snapshot.averageAngle,
    angleChange: snapshot.angleDelta,
    postureChanges: snapshot.postureChanges,
    persistentIncorrectPostureSeconds: snapshot.persistentIncorrectSeconds,
    incorrectPostureEvents: snapshot.incorrectPostureEvents,
    goodPosturePercentage: snapshot.goodPosturePercentage,
    sampleCount: snapshot.sampleCount,
    coverageSeconds: snapshot.coverageSeconds,
    dataQuality: snapshot.dataQuality,
  };
}

export interface LiveRecommendationView {
  deviceId: string | null;
  available: boolean;
  stale: boolean;
  dataQuality: LiveDataQuality;
  windowMinutes: number;
  sampleCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  latestSampleAgeSeconds: number | null;
  current: {
    posture: PostureLabel;
    angle: number | null;
    confidence: number | null;
    alert: boolean;
    timestamp: string | null;
  } | null;
  dominantPosture: PostureLabel | null;
  postureDistribution: { label: PostureLabel; count: number; percentage: number }[];
  averageAngle: number | null;
  angleDelta: number | null;
  postureChanges: number;
  incorrectPostureEvents: number;
  persistentIncorrectSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  summary: string | null;
  advice: CoachingAdvice | null;
  /** Where the wording came from: Gemini, the deterministic template, or nothing. */
  source: 'gemini' | 'fallback' | 'none';
  model: string | null;
  cached: boolean;
  generatedAt: string;
  aiConfigured: boolean;
  disclaimer: string;
  message: string;
}

/**
 * In-memory cache for live coaching.
 *
 * Two rules drive the design:
 *
 *  - Live polling must not cost one Gemini call per request or per measurement,
 *    so the entry is keyed by the *coaching context* rather than by the raw
 *    sample set. Adding one more measurement of the same posture does not
 *    change the key, so the wording stays stable while the situation is the same.
 *  - Only the coaching text is cached. The numeric payload is rebuilt from the
 *    current snapshot on every request, so a reused recommendation can never
 *    display an outdated sample count or reading age.
 *
 * Live advice is never persisted as a historical recommendation.
 */
interface LiveCoachingPayload {
  summary: string | null;
  advice: CoachingAdvice | null;
  source: LiveRecommendationView['source'];
  model: string | null;
  message: string;
}

interface LiveCacheEntry {
  expiresAt: number;
  payload: LiveCoachingPayload;
}

const LIVE_CACHE_MAX_ENTRIES = 200;
const liveCache = new Map<string, LiveCacheEntry>();

/** Test helper: drops every cached live answer. */
export function clearLiveCache(): void {
  liveCache.clear();
}

function readLiveCache(key: string): LiveCoachingPayload | null {
  const entry = liveCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    liveCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeLiveCache(key: string, payload: LiveCoachingPayload): void {
  if (liveCache.size >= LIVE_CACHE_MAX_ENTRIES) {
    const oldest = liveCache.keys().next().value;
    if (oldest !== undefined) {
      liveCache.delete(oldest);
    }
  }
  liveCache.set(key, { expiresAt: Date.now() + env.AI_LIVE_CACHE_TTL_SECONDS * 1000, payload });
}

/** The aggregated signals the coach is allowed to reason about. */
function buildCoachingContext(snapshot: LiveSnapshot): CoachingContext {
  return {
    posture: snapshot.currentPosture,
    persistentIncorrectSeconds: snapshot.persistentIncorrectSeconds,
    incorrectPostureEvents: snapshot.incorrectPostureEvents,
    postureChanges: snapshot.postureChanges,
    sampleCount: snapshot.sampleCount,
    dataQuality: snapshot.dataQuality,
    goodPosturePercentage: snapshot.goodPosturePercentage,
    // The distribution is sorted most-frequent first.
    dominantCount: snapshot.postureDistribution[0]?.count ?? 0,
  };
}

/**
 * Identity of the coaching situation. Two windows share a key when the advice
 * they should produce is the same: the posture, how urgent it is and how dense
 * the window is. Persistent-duration and change-count buckets absorb the small
 * drift produced by a few extra samples.
 */
function buildLiveCoachingKey(
  snapshot: LiveSnapshot,
  context: CoachingContext,
  priority: CoachingPriority,
): string {
  return [
    snapshot.deviceId ?? '*',
    snapshot.windowMinutes,
    context.posture ?? 'none',
    snapshot.dataQuality,
    priority,
    Math.floor(context.persistentIncorrectSeconds / COACHING_THRESHOLDS.persistentIncorrectSeconds),
    Math.floor(context.postureChanges / 5),
  ].join('|');
}

/** Reused wording, so the user stops seeing a different paragraph every refresh. */
const LIVE_CACHE_REUSE_MESSAGE =
  'Live coaching reused: the recent context has not changed materially.';

export interface LiveRecommendationInput {
  deviceId?: string | null;
  windowMinutes?: number;
}

/**
 * Advice for the posture observed in a short rolling window of real telemetry.
 *
 * Unlike `generateRecommendations`, this endpoint never stores a historical
 * recommendation and never fails because of Gemini: when the provider is
 * missing, slow, rate limited or returns unusable JSON, the deterministic
 * posture-specific template is returned instead.
 */
export async function generateLiveRecommendation(
  input: LiveRecommendationInput = {},
): Promise<LiveRecommendationView> {
  const deviceId = input.deviceId ?? null;
  const windowMinutes = input.windowMinutes ?? env.AI_LIVE_WINDOW_MINUTES;
  const now = new Date();
  const from = new Date(now.getTime() - windowMinutes * 60_000);

  const samples = await loadLiveSamples(deviceId, from, now, env.AI_LIVE_MAX_SAMPLES);
  const snapshot = buildLiveSnapshot(samples, { deviceId, windowMinutes, now });

  const base = {
    deviceId: snapshot.deviceId,
    available: snapshot.sampleCount > 0,
    stale: snapshot.stale,
    dataQuality: snapshot.dataQuality,
    windowMinutes: snapshot.windowMinutes,
    sampleCount: snapshot.sampleCount,
    observedFrom: snapshot.observedFrom,
    observedTo: snapshot.observedTo,
    latestSampleAgeSeconds: snapshot.latestSampleAgeSeconds,
    current: snapshot.currentPosture
      ? {
          posture: snapshot.currentPosture,
          angle: snapshot.currentAngle,
          confidence: snapshot.currentConfidence,
          alert: snapshot.currentAlert,
          timestamp: snapshot.observedTo,
        }
      : null,
    dominantPosture: snapshot.dominantPosture,
    postureDistribution: snapshot.postureDistribution,
    averageAngle: snapshot.averageAngle,
    angleDelta: snapshot.angleDelta,
    postureChanges: snapshot.postureChanges,
    incorrectPostureEvents: snapshot.incorrectPostureEvents,
    persistentIncorrectSeconds: snapshot.persistentIncorrectSeconds,
    monitoredDurationSeconds: snapshot.monitoredDurationSeconds,
    goodPosturePercentage: snapshot.goodPosturePercentage,
    generatedAt: new Date().toISOString(),
    aiConfigured: isGeminiConfigured(),
    disclaimer: DISCLAIMER,
  };

  if (snapshot.sampleCount === 0) {
    return {
      ...base,
      summary: null,
      advice: null,
      source: 'none',
      model: null,
      cached: false,
      message: `No telemetry was received in the last ${windowMinutes} minute(s) for this device.`,
    };
  }

  const context = buildCoachingContext(snapshot);
  // The deterministic template is both the fallback and the floor of the
  // coaching: it is produced from real aggregates on every request.
  const fallbackAdvice = coachingAdviceFor(context);
  const fallbackSummary = buildFallbackSummary(snapshot);

  // Never dress stale telemetry up as a live reading, and never pay for an
  // analysis of data that is already out of date.
  if (snapshot.stale) {
    return {
      ...base,
      summary: fallbackSummary,
      advice: fallbackAdvice,
      source: 'fallback',
      model: null,
      cached: false,
      message: `Latest telemetry is stale (${snapshot.latestSampleAgeSeconds}s old); showing the last known posture.`,
    };
  }

  const cacheKey = buildLiveCoachingKey(snapshot, context, fallbackAdvice.priority);

  const cached = readLiveCache(cacheKey);
  if (cached) {
    // Fresh numbers, unchanged wording.
    return { ...base, ...cached, cached: true, message: LIVE_CACHE_REUSE_MESSAGE };
  }

  if (!isGeminiConfigured()) {
    const payload: LiveCoachingPayload = {
      summary: fallbackSummary,
      advice: fallbackAdvice,
      source: 'fallback',
      model: null,
      message: 'Gemini is not configured; standard posture coaching returned.',
    };
    writeLiveCache(cacheKey, payload);
    return { ...base, ...payload, cached: false };
  }

  try {
    const { model, result } = await requestLiveAdvice(buildLiveAiPayload(snapshot));

    if (!isLiveAdviceUsable(result)) {
      throw AppError.badGateway('Gemini live advice exceeded the coaching card limits', {
        limits: 'title<=12 words, immediateAction<=45 words, futureImpact/reason<=45 words',
      });
    }

    const payload: LiveCoachingPayload = {
      // The factual frame stays backend-computed; only the coaching is model-written.
      summary: fallbackSummary,
      advice: {
        title: result.title,
        immediateAction: result.immediateAction,
        futureImpact: result.futureImpact,
        // Escalate-only: the model may raise the urgency but never downplay a
        // signal the telemetry already justifies.
        priority: maxPriority(fallbackAdvice.priority, result.priority),
        reason: result.reason,
      },
      source: 'gemini',
      model,
      message: 'Live coaching generated for the current posture.',
    };
    writeLiveCache(cacheKey, payload);
    return { ...base, ...payload, cached: false };
  } catch (error) {
    logger.error({ err: error }, 'Live Gemini advice failed; using the posture template instead');
    const payload: LiveCoachingPayload = {
      summary: fallbackSummary,
      advice: fallbackAdvice,
      source: 'fallback',
      model: null,
      message: 'Gemini did not return usable coaching; standard posture coaching returned instead.',
    };
    writeLiveCache(cacheKey, payload);
    return { ...base, ...payload, cached: false };
  }
}
