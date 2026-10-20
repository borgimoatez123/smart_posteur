import { Telemetry } from '../telemetry/telemetry.model';
import { Device } from '../devices/device.model';
import { computeDeviceStatus } from '../devices/device.service';
import { computePostureStats, EMPTY_POSTURE_STATS, type PostureSample, type PostureStats } from '../../utils/posture-stats';
import { env } from '../../config/env';
import { roundTo } from '../../utils/validation';
import { POSTURE_LABELS, type DeviceStatusValue, type PostureLabel } from '../../shared/domain';
import { logger } from '../../utils/logger';

export const DASHBOARD_PERIODS = ['day', 'week', 'month'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Hard limit so an unbounded history can never exhaust memory. */
export const MAX_DASHBOARD_SAMPLES = 50_000;

export interface PeriodRange {
  from: Date;
  to: Date;
  bucketUnit: 'hour' | 'day';
  bucketCount: number;
}

export interface TrendBucket {
  label: string;
  start: string;
  end: string;
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  goodPosturePercentage: number;
}

export interface PostureDistributionEntry {
  label: PostureLabel;
  count: number;
  percentage: number;
}

export interface DashboardTotals {
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  averageAngle: number | null;
}

export interface DashboardSummaryView {
  period: DashboardPeriod;
  deviceId: string | null;
  range: { from: string; to: string };
  totals: DashboardTotals;
  postureDistribution: PostureDistributionEntry[];
  trends: TrendBucket[];
  hasData: boolean;
  message?: string;
}

export interface CurrentPostureView {
  available: boolean;
  deviceId: string | null;
  posture: PostureLabel | null;
  angle: number | null;
  confidence: number | null;
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  timestamp: string | null;
  deviceStatus: DeviceStatusValue;
  lastSeen: string | null;
  message?: string;
}

/**
 * Aligns the analysis window on natural boundaries so consecutive calls are
 * comparable and the frontend can draw a stable chart axis.
 */
export function resolvePeriodRange(period: DashboardPeriod, now: Date = new Date()): PeriodRange {
  if (period === 'day') {
    const startOfHour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    return {
      from: new Date(startOfHour.getTime() - 23 * 3_600_000),
      to: now,
      bucketUnit: 'hour',
      bucketCount: 24,
    };
  }

  const bucketCount = period === 'week' ? 7 : 30;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    from: new Date(startOfToday.getTime() - (bucketCount - 1) * 86_400_000),
    to: now,
    bucketUnit: 'day',
    bucketCount,
  };
}

async function loadSamples(deviceId: string | null, from: Date, to: Date): Promise<PostureSample[]> {
  const filter: Record<string, unknown> = { timestamp: { $gte: from, $lte: to } };
  if (deviceId) {
    filter.deviceId = deviceId;
  }

  const documents = await Telemetry.find(filter)
    .sort({ timestamp: 1 })
    .select('timestamp posture')
    .limit(MAX_DASHBOARD_SAMPLES)
    .lean();

  if (documents.length === MAX_DASHBOARD_SAMPLES) {
    logger.warn({ deviceId, from, to }, 'Dashboard statistics reached the sample limit; values may be truncated');
  }

  return documents.map((document) => ({
    timestamp: document.timestamp as Date,
    label: document.posture.label as PostureLabel,
    angle: document.posture.angle ?? null,
  }));
}

function buildDistribution(samples: readonly PostureSample[]): PostureDistributionEntry[] {
  const counts = new Map<PostureLabel, number>();
  for (const sample of samples) {
    counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1);
  }

  return POSTURE_LABELS.filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => {
      const count = counts.get(label) ?? 0;
      return {
        label,
        count,
        percentage: roundTo((count / samples.length) * 100, 2),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function bucketLabel(date: Date, unit: 'hour' | 'day'): string {
  if (unit === 'hour') {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00`;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildTrends(samples: readonly PostureSample[], range: PeriodRange): TrendBucket[] {
  const unitMs = range.bucketUnit === 'hour' ? 3_600_000 : 86_400_000;
  const buckets: PostureSample[][] = Array.from({ length: range.bucketCount }, () => []);

  for (const sample of samples) {
    const offset = sample.timestamp.getTime() - range.from.getTime();
    const index = Math.min(Math.max(Math.floor(offset / unitMs), 0), range.bucketCount - 1);
    buckets[index].push(sample);
  }

  return buckets.map((bucketSamples, index) => {
    const start = new Date(range.from.getTime() + index * unitMs);
    const end = new Date(start.getTime() + unitMs);
    const stats = computePostureStats(bucketSamples, { maxGapSeconds: env.SESSION_MAX_GAP_SECONDS });
    return {
      label: bucketLabel(start, range.bucketUnit),
      start: start.toISOString(),
      end: end.toISOString(),
      measurements: stats.measurements,
      incorrectPostureEvents: stats.incorrectPostureEvents,
      goodDurationSeconds: stats.goodDurationSeconds,
      badDurationSeconds: stats.badDurationSeconds,
      goodPosturePercentage: stats.goodPosturePercentage,
    };
  });
}

function toTotals(stats: PostureStats): DashboardTotals {
  return {
    measurements: stats.measurements,
    incorrectPostureEvents: stats.incorrectPostureEvents,
    goodDurationSeconds: stats.goodDurationSeconds,
    badDurationSeconds: stats.badDurationSeconds,
    monitoredDurationSeconds: stats.monitoredDurationSeconds,
    goodPosturePercentage: stats.goodPosturePercentage,
    averageAngle: stats.averageAngle,
  };
}

/**
 * Aggregated posture statistics for a period. Every value is derived from
 * stored telemetry - nothing is fabricated to make the dashboard look full.
 */
export async function getSummary(
  period: DashboardPeriod,
  deviceId?: string | null,
): Promise<DashboardSummaryView> {
  const range = resolvePeriodRange(period);
  const normalizedDeviceId = deviceId ?? null;
  const samples = await loadSamples(normalizedDeviceId, range.from, range.to);
  const trends = buildTrends(samples, range);

  if (samples.length === 0) {
    return {
      period,
      deviceId: normalizedDeviceId,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: toTotals(EMPTY_POSTURE_STATS),
      postureDistribution: [],
      trends,
      hasData: false,
      message: 'No posture measurements were recorded for this period yet.',
    };
  }

  const stats = computePostureStats(samples, { maxGapSeconds: env.SESSION_MAX_GAP_SECONDS });

  return {
    period,
    deviceId: normalizedDeviceId,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: toTotals(stats),
    postureDistribution: buildDistribution(samples),
    trends,
    hasData: true,
  };
}

/** Latest observed posture, from real telemetry (never a placeholder). */
export async function getCurrent(deviceId?: string | null): Promise<CurrentPostureView> {
  const normalizedDeviceId = deviceId ?? null;
  const telemetryFilter = normalizedDeviceId ? { deviceId: normalizedDeviceId } : {};
  const deviceFilter = normalizedDeviceId ? { deviceId: normalizedDeviceId } : {};

  const [latest, device] = await Promise.all([
    Telemetry.findOne(telemetryFilter).sort({ timestamp: -1 }).lean(),
    Device.findOne(deviceFilter).sort({ lastSeen: -1 }).lean(),
  ]);

  const deviceStatus = computeDeviceStatus(device?.lastSeen ?? null);
  const lastSeen = device?.lastSeen ? device.lastSeen.toISOString() : null;

  if (!latest) {
    return {
      available: false,
      deviceId: normalizedDeviceId ?? (device?.deviceId ?? null),
      posture: null,
      angle: null,
      confidence: null,
      alert: false,
      battery: device?.batteryLevel ?? null,
      sensorError: false,
      timestamp: null,
      deviceStatus,
      lastSeen,
      message: 'No telemetry has been received yet.',
    };
  }

  return {
    available: true,
    deviceId: latest.deviceId,
    posture: latest.posture.label as PostureLabel,
    angle: latest.posture.angle ?? null,
    confidence: latest.posture.confidence ?? null,
    alert: latest.alert ?? false,
    battery: latest.battery ?? device?.batteryLevel ?? null,
    sensorError: latest.sensorError ?? false,
    timestamp: (latest.timestamp as Date).toISOString(),
    deviceStatus,
    lastSeen,
  };
}

export interface DashboardView {
  generatedAt: string;
  current: CurrentPostureView;
  summary: DashboardSummaryView;
}

/** Everything the Flutter dashboard needs in a single round trip. */
export async function getDashboard(deviceId?: string | null): Promise<DashboardView> {
  const [current, summary] = await Promise.all([getCurrent(deviceId), getSummary('day', deviceId)]);
  return {
    generatedAt: new Date().toISOString(),
    current,
    summary,
  };
}
