import type { PostureSession, PostureEpisode, PostureClass } from '../types/posture';
import { PostureClass as PostureClassEnum } from '../types/posture';

export interface DailyStatistics {
  date: string;
  goodDurationSeconds: number;
  poorDurationSeconds: number;
  unknownDurationSeconds: number;
  goodPosturePercent: number | null;
  postureCounts: Record<PostureClass, number>;
  alertCount: number;
}

const POOR_POSTURES: PostureClass[] = [
  PostureClassEnum.SLOUCHING,
  PostureClassEnum.LEAN_LEFT,
  PostureClassEnum.LEAN_RIGHT,
  PostureClassEnum.HEAD_FORWARD,
];

/**
 * Compute daily statistics from a session.
 *
 * Good-posture percentage = good_duration / total_classified_duration × 100.
 * UNKNOWN and missing segments are EXCLUDED from both numerator and denominator.
 */
export function computeDailyStats(session: PostureSession): DailyStatistics {
  let good = 0;
  let poor = 0;
  let unknown = 0;
  const counts: Record<PostureClass, number> = {
    [PostureClassEnum.GOOD_POSTURE]: 0,
    [PostureClassEnum.SLOUCHING]: 0,
    [PostureClassEnum.LEAN_LEFT]: 0,
    [PostureClassEnum.LEAN_RIGHT]: 0,
    [PostureClassEnum.HEAD_FORWARD]: 0,
    [PostureClassEnum.UNKNOWN]: 0,
  };

  for (const ep of session.episodes) {
    const dur = ep.durationSeconds;
    counts[ep.posture] += dur;
    if (ep.posture === PostureClassEnum.GOOD_POSTURE) {
      good += dur;
    } else if (ep.posture === PostureClassEnum.UNKNOWN) {
      unknown += dur;
    } else if (POOR_POSTURES.includes(ep.posture)) {
      poor += dur;
    }
  }

  const classifiedTotal = good + poor;
  const goodPosturePercent =
    classifiedTotal > 0 ? (good / classifiedTotal) * 100 : null;

  return {
    date: session.date,
    goodDurationSeconds: good,
    poorDurationSeconds: poor,
    unknownDurationSeconds: unknown,
    goodPosturePercent,
    postureCounts: counts,
    alertCount: session.alertCount,
  };
}

/** Aggregate multiple sessions into weekly statistics. */
export function computeWeeklyStats(sessions: PostureSession[]): DailyStatistics[] {
  return sessions.map(computeDailyStats);
}

/** Average good-posture percentage across days that have classified data. */
export function averageGoodPosturePercent(
  stats: DailyStatistics[],
): number | null {
  const valid = stats.filter((s) => s.goodPosturePercent !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, s) => acc + (s.goodPosturePercent as number), 0);
  return sum / valid.length;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}
