import { Telemetry } from './telemetry.model';
import type { IngestTelemetryInput, SensorsInput } from './telemetry.validation';
import { computeDeviceStatus, getDeviceSnapshotState, touchDevice } from '../devices/device.service';
import { createEvent } from '../events/event.service';
import { Session } from '../sessions/session.model';
import { isBadPosture } from '../../shared/domain';
import type { DeviceStatusValue, EventType, PostureLabel } from '../../shared/domain';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { emitDeviceStatus, emitPostureAlert, emitPostureUpdate } from '../../sockets/socket.server';

const SENSOR_KEYS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'] as const;

export interface IngestTelemetryResult {
  recordId: string;
  created: boolean;
  duplicate: boolean;
  sessionId: string | null;
  eventsCreated: EventType[];
}

export interface IngestOutcome {
  result: IngestTelemetryResult;
  /** 201 when a new record was stored, 200 for an idempotent retry. */
  statusCode: number;
}

function detectSensorError(sensors: SensorsInput | null | undefined): boolean {
  if (!sensors) {
    return false;
  }
  return !SENSOR_KEYS.some((key) => {
    const value = sensors[key];
    return typeof value === 'number' && Number.isFinite(value);
  });
}

/**
 * Idempotency key.
 *
 * The ESP32 retries a telemetry POST when it does not receive an HTTP response
 * (network glitch, backend restart). Because a retry replays the exact same
 * payload, `deviceId + timestamp + posture label + alert flag` identifies the
 * occurrence and the unique index on `dedupeKey` makes the second write a no-op.
 *
 * When the device omits the timestamp the server fills it in, so retries of a
 * timestamp-less payload are NOT deduplicated. Devices are therefore expected to
 * send their own timestamp.
 */
export function buildTelemetryDedupeKey(
  deviceId: string,
  timestamp: Date,
  label: PostureLabel,
  alert: boolean,
): string {
  return `${deviceId}:${timestamp.toISOString()}:${label}:${alert ? 'alert' : 'ok'}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Stores one telemetry sample and derives state transitions from it.
 *
 * The backend never drives the vibration motor: the ESP32 classifies posture and
 * vibrates locally. This function only records what happened and, when a state
 * changes, stores a single event instead of one event per sample.
 */
export async function ingestTelemetry(input: IngestTelemetryInput): Promise<IngestOutcome> {
  const receivedAt = new Date();
  const timestamp = input.timestamp ?? receivedAt;
  const label = input.posture.label;
  const alert = input.alert ?? false;
  const battery = input.battery ?? null;
  const samplingHz = input.samplingHz ?? env.TELEMETRY_SAMPLING_HZ;
  const sensors = input.sensors ?? null;
  const sensorError = detectSensorError(sensors);
  const dedupeKey = buildTelemetryDedupeKey(input.deviceId, timestamp, label, alert);

  // Idempotent retry: the same occurrence was already stored.
  const duplicate = await Telemetry.findOne({ dedupeKey }).select('_id sessionId').lean();
  if (duplicate) {
    return {
      statusCode: 200,
      result: {
        recordId: String(duplicate._id),
        created: false,
        duplicate: true,
        sessionId: duplicate.sessionId ? String(duplicate.sessionId) : null,
        eventsCreated: [],
      },
    };
  }

  const [previousDevice, activeSession] = await Promise.all([
    getDeviceSnapshotState(input.deviceId),
    Session.findOne({ deviceId: input.deviceId, endedAt: null }).sort({ startedAt: -1 }).select('_id').lean(),
  ]);

  const sessionId = activeSession ? String(activeSession._id) : null;
  const previousTelemetry = previousDevice?.lastTelemetry ?? null;
  const previousStatus: DeviceStatusValue = previousDevice?.status ?? 'unknown';

  let record;
  try {
    record = await Telemetry.create({
      deviceId: input.deviceId,
      timestamp,
      sensors,
      posture: {
        label,
        angle: input.posture.angle,
        confidence: input.posture.confidence ?? null,
        badDurationSeconds: input.posture.badDurationSeconds ?? null,
      },
      alert,
      battery,
      sensorError,
      sessionId: activeSession?._id ?? null,
      samplingHz,
      dedupeKey,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await Telemetry.findOne({ dedupeKey }).select('_id sessionId').lean();
      return {
        statusCode: 200,
        result: {
          recordId: existing ? String(existing._id) : '',
          created: false,
          duplicate: true,
          sessionId: existing?.sessionId ? String(existing.sessionId) : null,
          eventsCreated: [],
        },
      };
    }
    logger.error({ err: error, deviceId: input.deviceId }, 'Failed to store telemetry');
    throw error;
  }

  await touchDevice(
    input.deviceId,
    {
      posture: label,
      angle: input.posture.angle,
      confidence: input.posture.confidence ?? null,
      alert,
      battery,
      sensorError,
      timestamp,
    },
    receivedAt,
  );

  const eventsCreated = await recordTransitions({
    deviceId: input.deviceId,
    sessionId,
    timestamp,
    label,
    alert,
    battery,
    sensorError,
    previousStatus,
    previousTelemetry,
  });

  emitPostureUpdate({
    deviceId: input.deviceId,
    posture: label,
    angle: input.posture.angle,
    confidence: input.posture.confidence ?? null,
    alert,
    battery,
    timestamp: timestamp.toISOString(),
  });

  if (alert || isBadPosture(label)) {
    emitPostureAlert({
      deviceId: input.deviceId,
      posture: label,
      angle: input.posture.angle,
      confidence: input.posture.confidence ?? null,
      alert,
      battery,
      timestamp: timestamp.toISOString(),
      severity: alert ? 'warning' : 'info',
    });
  }

  return {
    statusCode: 201,
    result: {
      recordId: String(record._id),
      created: true,
      duplicate: false,
      sessionId,
      eventsCreated,
    },
  };
}

interface TransitionContext {
  deviceId: string;
  sessionId: string | null;
  timestamp: Date;
  label: PostureLabel;
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  previousStatus: DeviceStatusValue;
  previousTelemetry: {
    posture: PostureLabel | null;
    alert: boolean;
    battery: number | null;
    sensorError: boolean;
  } | null;
}

async function recordTransitions(context: TransitionContext): Promise<EventType[]> {
  const created: EventType[] = [];
  const previous = context.previousTelemetry;

  const emit = async (
    type: EventType,
    metadata: Record<string, unknown>,
    severity?: 'info' | 'warning' | 'critical',
  ): Promise<void> => {
    const result = await createEvent({
      deviceId: context.deviceId,
      sessionId: context.sessionId,
      type,
      severity,
      timestamp: context.timestamp,
      metadata,
    });
    if (result.created) {
      created.push(type);
    }
  };

  if (context.previousStatus === 'offline') {
    await emit('DEVICE_RECONNECTED', { reason: 'telemetry' });
    emitDeviceStatus({
      deviceId: context.deviceId,
      status: 'online',
      lastSeen: context.timestamp.toISOString(),
      timestamp: context.timestamp.toISOString(),
    });
  }

  if (isBadPosture(context.label) && !isBadPosture(previous?.posture ?? null)) {
    await emit('POSTURE_INCORRECT', {
      posture: context.label,
      previousPosture: previous?.posture ?? null,
    });
  }

  if (context.alert && !previous?.alert) {
    await emit('VIBRATION_ALERT', { posture: context.label });
  }

  const threshold = env.LOW_BATTERY_THRESHOLD;
  if (
    context.battery !== null &&
    context.battery <= threshold &&
    (previous?.battery == null || previous.battery > threshold)
  ) {
    await emit('LOW_BATTERY', { battery: context.battery, threshold });
  }

  if (context.sensorError && !previous?.sensorError) {
    await emit('SENSOR_ERROR', { reason: 'no usable sensor values in payload' }, 'critical');
  }

  return created;
}

export function resolveEffectiveStatus(lastSeen: Date | null): DeviceStatusValue {
  return computeDeviceStatus(lastSeen);
}
