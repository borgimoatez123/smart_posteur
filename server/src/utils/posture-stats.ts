import { isBadPosture, isGoodPosture, type PostureLabel } from '../shared/domain';
import { roundTo } from './validation';

export interface PostureSample {
  timestamp: Date;
  label: PostureLabel;
  angle?: number | null;
}

export interface PostureStats {
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  averageAngle: number | null;
  firstSampleAt: Date | null;
  lastSampleAt: Date | null;
}

export const EMPTY_POSTURE_STATS: PostureStats = {
  measurements: 0,
  incorrectPostureEvents: 0,
  goodDurationSeconds: 0,
  badDurationSeconds: 0,
  monitoredDurationSeconds: 0,
  goodPosturePercentage: 0,
  averageAngle: null,
  firstSampleAt: null,
  lastSampleAt: null,
};

export interface ComputePostureStatsOptions {
  /**
   * Largest gap (in seconds) between two consecutive samples that still counts
   * as monitored time. Anything longer (device offline, phone switched off) is
   * ignored rather than being attributed to good or bad posture.
   */
  maxGapSeconds: number;
}

/**
 * Derives statistics from discrete telemetry samples.
 *
 * Durations are computed from the time delta between consecutive samples and
 * the posture state that was active during that delta. Samples are never summed
 * as if each one represented exactly one second.
 */
export function computePostureStats(
  samples: readonly PostureSample[],
  options: ComputePostureStatsOptions,
): PostureStats {
  if (samples.length === 0) {
    return { ...EMPTY_POSTURE_STATS };
  }

  const ordered = [...samples].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const maxGap = Math.max(options.maxGapSeconds, 0);

  let goodDuration = 0;
  let badDuration = 0;
  let incorrectEvents = 0;
  let angleSum = 0;
  let angleCount = 0;
  let previousWasBad = false;

  for (let index = 0; index < ordered.length; index += 1) {
    const sample = ordered[index];
    const bad = isBadPosture(sample.label);
    const good = isGoodPosture(sample.label);

    // Count a single event per continuous incorrect-posture run instead of one
    // event per sample.
    if (bad && !previousWasBad) {
      incorrectEvents += 1;
    }
    previousWasBad = bad;

    if (typeof sample.angle === 'number' && Number.isFinite(sample.angle)) {
      angleSum += sample.angle;
      angleCount += 1;
    }

    const next = ordered[index + 1];
    if (!next) {
      continue;
    }

    const deltaSeconds = (next.timestamp.getTime() - sample.timestamp.getTime()) / 1000;
    if (deltaSeconds <= 0) {
      continue;
    }

    const counted = Math.min(deltaSeconds, maxGap);
    if (good) {
      goodDuration += counted;
    } else if (bad) {
      badDuration += counted;
    }
    // UNKNOWN samples contribute to neither bucket.
  }

  const monitoredDuration = goodDuration + badDuration;
  const first = ordered[0].timestamp;
  const last = ordered[ordered.length - 1].timestamp;

  return {
    measurements: ordered.length,
    incorrectPostureEvents: incorrectEvents,
    goodDurationSeconds: roundTo(goodDuration, 2),
    badDurationSeconds: roundTo(badDuration, 2),
    monitoredDurationSeconds: roundTo(monitoredDuration, 2),
    goodPosturePercentage: monitoredDuration > 0 ? roundTo((goodDuration / monitoredDuration) * 100, 2) : 0,
    averageAngle: angleCount > 0 ? roundTo(angleSum / angleCount, 2) : null,
    firstSampleAt: first,
    lastSampleAt: last,
  };
}
