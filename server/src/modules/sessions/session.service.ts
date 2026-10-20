import { Session } from './session.model';
import { Telemetry } from '../telemetry/telemetry.model';
import { AppError } from '../../utils/http-error';
import { env } from '../../config/env';
import { calculatePostureStatsForRange } from '../../utils/posture-stats.query';
import type { PostureStats } from '../../utils/posture-stats';
import { buildPaginatedResult, type PaginatedResult } from '../../utils/pagination';
import type { CreateSessionBody, ListSessionsQuery } from './session.validation';

/** Upper bound for statistics computation to protect the server from huge windows. */
export const MAX_STATISTICS_SAMPLES = 50_000;

export interface SessionView {
  id: string;
  deviceId: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  statistics: PostureStats;
  statisticsAreFinal: boolean;
  notes: string | null;
  createdAt: string | null;
}

type SessionLike = {
  _id: unknown;
  deviceId: string;
  startedAt: Date;
  endedAt?: Date | null;
  notes?: string | null;
  createdAt?: Date | null;
  statistics?: {
    measurements?: number | null;
    incorrectPostureEvents?: number | null;
    goodDurationSeconds?: number | null;
    badDurationSeconds?: number | null;
    monitoredDurationSeconds?: number | null;
    goodPosturePercentage?: number | null;
    averageAngle?: number | null;
  } | null;
};

function toStoredStatistics(session: SessionLike): PostureStats {
  const statistics = session.statistics ?? {};
  return {
    measurements: statistics.measurements ?? 0,
    incorrectPostureEvents: statistics.incorrectPostureEvents ?? 0,
    goodDurationSeconds: statistics.goodDurationSeconds ?? 0,
    badDurationSeconds: statistics.badDurationSeconds ?? 0,
    monitoredDurationSeconds: statistics.monitoredDurationSeconds ?? 0,
    goodPosturePercentage: statistics.goodPosturePercentage ?? 0,
    averageAngle: statistics.averageAngle ?? null,
    firstSampleAt: null,
    lastSampleAt: null,
  };
}

function toSessionView(session: SessionLike, statistics: PostureStats, statisticsAreFinal: boolean): SessionView {
  const endedAt = session.endedAt ?? null;
  return {
    id: String(session._id),
    deviceId: session.deviceId,
    status: endedAt ? 'ended' : 'active',
    startedAt: session.startedAt.toISOString(),
    endedAt: endedAt ? endedAt.toISOString() : null,
    durationSeconds: endedAt
      ? Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000))
      : null,
    statistics,
    statisticsAreFinal,
    notes: session.notes ?? null,
    createdAt: session.createdAt ? session.createdAt.toISOString() : null,
  };
}

/**
 * Session statistics are derived from the telemetry that actually falls inside
 * the session window. Durations come from timestamp deltas and posture state
 * transitions - one sample is never assumed to represent exactly one second.
 */
export async function calculateSessionStatistics(
  deviceId: string,
  startedAt: Date,
  endedAt: Date,
): Promise<PostureStats> {
  return calculatePostureStatsForRange({
    deviceId,
    from: startedAt,
    to: endedAt,
    maxGapSeconds: env.SESSION_MAX_GAP_SECONDS,
    limit: MAX_STATISTICS_SAMPLES,
  });
}

export async function findActiveSession(deviceId: string) {
  return Session.findOne({ deviceId, endedAt: null }).sort({ startedAt: -1 });
}

export interface CreateSessionResult {
  session: SessionView;
  created: boolean;
}

export async function createSession(input: CreateSessionBody): Promise<CreateSessionResult> {
  const existing = await findActiveSession(input.deviceId);
  if (existing) {
    const statistics = await calculateSessionStatistics(input.deviceId, existing.startedAt, new Date());
    return {
      session: toSessionView(existing.toObject() as SessionLike, statistics, false),
      created: false,
    };
  }

  const startedAt = input.startedAt ?? new Date();
  const created = await Session.create({
    deviceId: input.deviceId,
    startedAt,
    endedAt: null,
    notes: input.notes ?? null,
    statistics: {},
  });

  const statistics = await calculateSessionStatistics(input.deviceId, startedAt, new Date());
  return {
    session: toSessionView(created.toObject() as SessionLike, statistics, false),
    created: true,
  };
}

export async function getSessionById(id: string): Promise<SessionView> {
  const session = await Session.findById(id);
  if (!session) {
    throw AppError.notFound(`Session ${id} was not found`, undefined, 'SESSION_NOT_FOUND');
  }

  const plain = session.toObject() as SessionLike;
  if (!session.endedAt) {
    const statistics = await calculateSessionStatistics(session.deviceId, session.startedAt, new Date());
    return toSessionView(plain, statistics, false);
  }

  return toSessionView(plain, toStoredStatistics(plain), true);
}

export interface EndSessionResult {
  session: SessionView;
  changed: boolean;
}

export async function endSession(
  id: string,
  input: { endedAt?: Date; notes?: string | null },
): Promise<EndSessionResult> {
  const session = await Session.findById(id);
  if (!session) {
    throw AppError.notFound(`Session ${id} was not found`, undefined, 'SESSION_NOT_FOUND');
  }

  if (session.endedAt) {
    const plain = session.toObject() as SessionLike;
    return { session: toSessionView(plain, toStoredStatistics(plain), true), changed: false };
  }

  const endedAt = input.endedAt ?? new Date();
  if (endedAt.getTime() < session.startedAt.getTime()) {
    throw AppError.badRequest('endedAt cannot be earlier than the session start', undefined, 'INVALID_SESSION_WINDOW');
  }

  const statistics = await calculateSessionStatistics(session.deviceId, session.startedAt, endedAt);

  session.endedAt = endedAt;
  if (input.notes !== undefined) {
    session.notes = input.notes ?? null;
  }
  session.statistics = {
    measurements: statistics.measurements,
    incorrectPostureEvents: statistics.incorrectPostureEvents,
    goodDurationSeconds: statistics.goodDurationSeconds,
    badDurationSeconds: statistics.badDurationSeconds,
    monitoredDurationSeconds: statistics.monitoredDurationSeconds,
    goodPosturePercentage: statistics.goodPosturePercentage,
    averageAngle: statistics.averageAngle,
  };
  await session.save();

  return { session: toSessionView(session.toObject() as SessionLike, statistics, true), changed: true };
}

export async function listSessions(query: ListSessionsQuery): Promise<PaginatedResult<SessionView>> {
  const filter: Record<string, unknown> = {};
  if (query.deviceId) filter.deviceId = query.deviceId;
  if (query.status === 'active') filter.endedAt = null;
  if (query.status === 'ended') filter.endedAt = { $ne: null };
  if (query.from || query.to) {
    filter.startedAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  const sortDirection = query.sort === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [documents, total] = await Promise.all([
    Session.find(filter).sort({ startedAt: sortDirection }).skip(skip).limit(query.limit).lean(),
    Session.countDocuments(filter),
  ]);

  const items = documents.map((document) => {
    const plain = document as SessionLike;
    return toSessionView(plain, toStoredStatistics(plain), Boolean(plain.endedAt));
  });

  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function findTelemetrySampleCount(deviceId: string, from: Date, to: Date): Promise<number> {
  return Telemetry.countDocuments({ deviceId, timestamp: { $gte: from, $lte: to } });
}
