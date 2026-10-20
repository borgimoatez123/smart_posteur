import { Telemetry } from '../telemetry/telemetry.model';
import type { PostureLabel } from '../../shared/domain';
import { buildPaginatedResult, type PaginatedResult } from '../../utils/pagination';
import type { ListHistoryQuery } from './history.validation';

export interface HistoryView {
  id: string;
  deviceId: string;
  timestamp: string;
  receivedAt: string | null;
  sensors: {
    ax: number | null;
    ay: number | null;
    az: number | null;
    gx: number | null;
    gy: number | null;
    gz: number | null;
  } | null;
  posture: {
    label: PostureLabel;
    angle: number;
    confidence: number | null;
    badDurationSeconds: number | null;
  };
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  sessionId: string | null;
  samplingHz: number | null;
}

type TelemetryLike = {
  _id: unknown;
  deviceId: string;
  timestamp: Date;
  createdAt?: Date | null;
  sensors?: {
    ax?: number | null;
    ay?: number | null;
    az?: number | null;
    gx?: number | null;
    gy?: number | null;
    gz?: number | null;
  } | null;
  posture: {
    label: string;
    angle: number;
    confidence?: number | null;
    badDurationSeconds?: number | null;
  };
  alert?: boolean | null;
  battery?: number | null;
  sensorError?: boolean | null;
  sessionId?: unknown;
  samplingHz?: number | null;
};

function toHistoryView(document: TelemetryLike): HistoryView {
  return {
    id: String(document._id),
    deviceId: document.deviceId,
    timestamp: document.timestamp.toISOString(),
    receivedAt: document.createdAt ? document.createdAt.toISOString() : null,
    sensors: document.sensors
      ? {
          ax: document.sensors.ax ?? null,
          ay: document.sensors.ay ?? null,
          az: document.sensors.az ?? null,
          gx: document.sensors.gx ?? null,
          gy: document.sensors.gy ?? null,
          gz: document.sensors.gz ?? null,
        }
      : null,
    posture: {
      label: document.posture.label as PostureLabel,
      angle: document.posture.angle,
      confidence: document.posture.confidence ?? null,
      badDurationSeconds: document.posture.badDurationSeconds ?? null,
    },
    alert: document.alert ?? false,
    battery: document.battery ?? null,
    sensorError: document.sensorError ?? false,
    sessionId: document.sessionId ? String(document.sessionId) : null,
    samplingHz: document.samplingHz ?? null,
  };
}

export async function listHistory(query: ListHistoryQuery): Promise<PaginatedResult<HistoryView>> {
  const filter: Record<string, unknown> = {};
  if (query.deviceId) filter.deviceId = query.deviceId;
  if (query.posture) filter['posture.label'] = query.posture;
  if (query.alert !== undefined) filter.alert = query.alert;
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
    Telemetry.find(filter).sort({ timestamp: sortDirection }).skip(skip).limit(query.limit).lean(),
    Telemetry.countDocuments(filter),
  ]);

  return buildPaginatedResult(
    documents.map((document) => toHistoryView(document as TelemetryLike)),
    total,
    query.page,
    query.limit,
  );
}

export async function getHistoryById(id: string): Promise<HistoryView | null> {
  const document = await Telemetry.findById(id).lean();
  return document ? toHistoryView(document as TelemetryLike) : null;
}
