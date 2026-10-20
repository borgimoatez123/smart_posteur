import type { Types } from 'mongoose';
import { PostureEvent } from './event.model';
import {
  DEFAULT_EVENT_SEVERITY,
  type EventSeverity,
  type EventType,
} from '../../shared/domain';
import { logger } from '../../utils/logger';
import {
  buildPaginatedResult,
  type PaginatedResult,
} from '../../utils/pagination';
import type { CreateEventBody, ListEventsQuery } from './event.validation';

export interface CreateEventInput {
  deviceId: string;
  type: EventType;
  timestamp?: Date;
  severity?: EventSeverity;
  sessionId?: string | Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}

export interface CreateEventResult {
  id: string;
  created: boolean;
  type: EventType;
  severity: EventSeverity;
  timestamp: Date;
}

export interface EventView {
  id: string;
  deviceId: string;
  sessionId: string | null;
  type: EventType;
  severity: EventSeverity;
  timestamp: string;
  metadata: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export function buildEventDedupeKey(
  deviceId: string,
  type: EventType,
  timestamp: Date,
): string {
  return `${deviceId}:${type}:${timestamp.toISOString()}`;
}

/**
 * Creates a meaningful event exactly once.
 *
 * Events are only produced on state transitions (see telemetry.service), and the
 * unique `dedupeKey` index is the last line of defence: a retried HTTP request or
 * a duplicated device report can never store the same event twice.
 */
export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const timestamp = input.timestamp ?? new Date();
  const severity = input.severity ?? DEFAULT_EVENT_SEVERITY[input.type];
  const dedupeKey = input.dedupeKey ?? buildEventDedupeKey(input.deviceId, input.type, timestamp);

  const existing = await PostureEvent.findOne({ dedupeKey }).select('_id type severity timestamp').lean();
  if (existing) {
    return {
      id: String(existing._id),
      created: false,
      type: existing.type as EventType,
      severity: existing.severity as EventSeverity,
      timestamp: existing.timestamp as Date,
    };
  }

  try {
    const created = await PostureEvent.create({
      deviceId: input.deviceId,
      sessionId: input.sessionId ?? null,
      type: input.type,
      severity,
      timestamp,
      metadata: input.metadata ?? {},
      dedupeKey,
    });

    return {
      id: String(created._id),
      created: true,
      type: input.type,
      severity,
      timestamp,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const duplicate = await PostureEvent.findOne({ dedupeKey }).select('_id type severity timestamp').lean();
      if (duplicate) {
        return {
          id: String(duplicate._id),
          created: false,
          type: duplicate.type as EventType,
          severity: duplicate.severity as EventSeverity,
          timestamp: duplicate.timestamp as Date,
        };
      }
    }
    logger.error({ err: error, deviceId: input.deviceId, type: input.type }, 'Failed to store event');
    throw error;
  }
}

function toEventView(document: {
  _id: unknown;
  deviceId: string;
  sessionId?: unknown;
  type: string;
  severity: string;
  timestamp: Date;
  metadata?: unknown;
}): EventView {
  return {
    id: String(document._id),
    deviceId: document.deviceId,
    sessionId: document.sessionId ? String(document.sessionId) : null,
    type: document.type as EventType,
    severity: document.severity as EventSeverity,
    timestamp: document.timestamp.toISOString(),
    metadata: (document.metadata as Record<string, unknown>) ?? {},
  };
}

export async function listEvents(query: ListEventsQuery): Promise<PaginatedResult<EventView>> {
  const filter: Record<string, unknown> = {};
  if (query.deviceId) filter.deviceId = query.deviceId;
  if (query.type) filter.type = query.type;
  if (query.severity) filter.severity = query.severity;
  if (query.sessionId) filter.sessionId = query.sessionId;
  if (query.from || query.to) {
    filter.timestamp = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  const sortDirection = query.sort === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [documents, total] = await Promise.all([
    PostureEvent.find(filter).sort({ timestamp: sortDirection }).skip(skip).limit(query.limit).lean(),
    PostureEvent.countDocuments(filter),
  ]);

  return buildPaginatedResult(documents.map(toEventView), total, query.page, query.limit);
}

export async function getEventById(id: string): Promise<EventView | null> {
  const document = await PostureEvent.findById(id).lean();
  return document ? toEventView(document) : null;
}

export async function createEventFromBody(body: CreateEventBody): Promise<CreateEventResult> {
  return createEvent({
    deviceId: body.deviceId,
    type: body.type,
    severity: body.severity,
    timestamp: body.timestamp,
    sessionId: body.sessionId ?? null,
    metadata: body.metadata,
    dedupeKey: body.dedupeKey,
  });
}
