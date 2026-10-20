import { Device } from './device.model';
import { deviceOfflineTimeoutMs, env } from '../../config/env';
import { AppError } from '../../utils/http-error';
import { logger } from '../../utils/logger';
import type { DeviceStatusValue, PostureLabel } from '../../shared/domain';
import { createEvent } from '../events/event.service';
import { emitDeviceStatus } from '../../sockets/socket.server';

export interface DeviceTelemetrySnapshot {
  posture: PostureLabel | null;
  angle: number | null;
  confidence: number | null;
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  timestamp: Date | null;
}

export interface DeviceSnapshotState {
  status: DeviceStatusValue;
  lastSeen: Date | null;
  batteryLevel: number | null;
  lastTelemetry: DeviceTelemetrySnapshot | null;
}

export interface DeviceView {
  deviceId: string;
  name: string | null;
  status: DeviceStatusValue;
  lastSeen: string | null;
  secondsSinceLastSeen: number | null;
  batteryLevel: number | null;
  latestPosture: PostureLabel | null;
  latestAngle: number | null;
  latestConfidence: number | null;
  latestAlert: boolean;
  latestTelemetryAt: string | null;
}

export interface DeviceStatusView {
  deviceId: string;
  name: string | null;
  status: DeviceStatusValue;
  lastSeen: string | null;
  secondsSinceLastSeen: number | null;
  latestPosture: PostureLabel | null;
  latestAngle: number | null;
  latestConfidence: number | null;
  latestAlert: boolean;
  latestTelemetryAt: string | null;
  batteryLevel: number | null;
  offlineTimeoutSeconds: number;
  heartbeatIntervalSeconds: number;
}

/**
 * A device is ONLINE when a heartbeat or telemetry arrived within the
 * configurable offline timeout (60s by default, heartbeat every 15s).
 */
export function computeDeviceStatus(lastSeen: Date | null | undefined, now: Date = new Date()): DeviceStatusValue {
  if (!lastSeen) {
    return 'unknown';
  }
  const elapsed = now.getTime() - lastSeen.getTime();
  if (elapsed < 0) {
    return 'online';
  }
  return elapsed <= deviceOfflineTimeoutMs ? 'online' : 'offline';
}

function secondsSince(lastSeen: Date | null, now: Date): number | null {
  if (!lastSeen) {
    return null;
  }
  return Math.max(0, Math.round((now.getTime() - lastSeen.getTime()) / 1000));
}

type DeviceLike = {
  deviceId: string;
  name?: string | null;
  lastSeen?: Date | null;
  batteryLevel?: number | null;
  lastTelemetry?: {
    posture?: string | null;
    angle?: number | null;
    confidence?: number | null;
    alert?: boolean | null;
    battery?: number | null;
    sensorError?: boolean | null;
    timestamp?: Date | null;
  } | null;
};

function toDeviceView(device: DeviceLike, now: Date): DeviceView {
  const lastSeen = device.lastSeen ?? null;
  const lastTelemetry = device.lastTelemetry ?? null;
  return {
    deviceId: device.deviceId,
    name: device.name ?? null,
    status: computeDeviceStatus(lastSeen, now),
    lastSeen: lastSeen ? lastSeen.toISOString() : null,
    secondsSinceLastSeen: secondsSince(lastSeen, now),
    batteryLevel: device.batteryLevel ?? null,
    latestPosture: (lastTelemetry?.posture as PostureLabel | null) ?? null,
    latestAngle: lastTelemetry?.angle ?? null,
    latestConfidence: lastTelemetry?.confidence ?? null,
    latestAlert: lastTelemetry?.alert ?? false,
    latestTelemetryAt: lastTelemetry?.timestamp ? lastTelemetry.timestamp.toISOString() : null,
  };
}

export async function listDevices(): Promise<DeviceView[]> {
  const now = new Date();
  const devices = await Device.find().sort({ lastSeen: -1 }).lean();
  return devices.map((device) => toDeviceView(device as DeviceLike, now));
}

export async function getDeviceSnapshotState(deviceId: string): Promise<DeviceSnapshotState | null> {
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) {
    return null;
  }
  const lastTelemetry = (device.lastTelemetry ?? null) as DeviceTelemetrySnapshot | null;
  return {
    status: computeDeviceStatus(device.lastSeen),
    lastSeen: device.lastSeen ?? null,
    batteryLevel: device.batteryLevel ?? null,
    lastTelemetry: lastTelemetry
      ? {
          posture: (lastTelemetry.posture ?? null) as PostureLabel | null,
          angle: lastTelemetry.angle ?? null,
          confidence: lastTelemetry.confidence ?? null,
          alert: lastTelemetry.alert ?? false,
          battery: lastTelemetry.battery ?? null,
          sensorError: lastTelemetry.sensorError ?? false,
          timestamp: lastTelemetry.timestamp ?? null,
        }
      : null,
  };
}

export async function getDeviceStatus(deviceId: string): Promise<DeviceStatusView> {
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) {
    throw AppError.notFound(`Device ${deviceId} is not known to this server`, undefined, 'DEVICE_NOT_FOUND');
  }
  const view = toDeviceView(device as DeviceLike, new Date());
  return {
    ...view,
    offlineTimeoutSeconds: env.DEVICE_OFFLINE_TIMEOUT_SECONDS,
    heartbeatIntervalSeconds: env.DEVICE_HEARTBEAT_INTERVAL_SECONDS,
  };
}

export async function getDeviceOrThrow(deviceId: string): Promise<DeviceView> {
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) {
    throw AppError.notFound(`Device ${deviceId} is not known to this server`, undefined, 'DEVICE_NOT_FOUND');
  }
  return toDeviceView(device as DeviceLike, new Date());
}

/**
 * Records a contact from a device (heartbeat or telemetry) and marks it online.
 * `lastSeen` deliberately uses the server clock so an out-of-sync device clock
 * cannot keep a silent device "online".
 */
export async function touchDevice(
  deviceId: string,
  snapshot: DeviceTelemetrySnapshot | null,
  receivedAt: Date = new Date(),
): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'online',
    lastSeen: receivedAt,
  };

  if (snapshot) {
    update.lastTelemetry = snapshot;
    if (snapshot.battery !== null) {
      update.batteryLevel = snapshot.battery;
    }
  }

  await Device.updateOne(
    { deviceId },
    { $set: update, $setOnInsert: { name: null } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export interface HeartbeatInput {
  battery?: number | null;
  timestamp?: Date;
}

export interface HeartbeatResult {
  deviceId: string;
  status: DeviceStatusValue;
  lastSeen: string;
  reconnectDetected: boolean;
  nextHeartbeatSeconds: number;
}

export async function recordHeartbeat(
  deviceId: string,
  input: HeartbeatInput = {},
): Promise<HeartbeatResult> {
  const receivedAt = new Date();
  const previous = await getDeviceSnapshotState(deviceId);

  await touchDevice(deviceId, previous?.lastTelemetry ?? null, receivedAt);

  if (input.battery != null) {
    await Device.updateOne({ deviceId }, { $set: { batteryLevel: input.battery } });
  }

  const wasOffline = previous !== null && previous.status === 'offline';

  if (wasOffline) {
    await createEvent({
      deviceId,
      type: 'DEVICE_RECONNECTED',
      timestamp: receivedAt,
      metadata: { lastSeenBefore: previous.lastSeen?.toISOString() ?? null },
    });
    emitDeviceStatus({
      deviceId,
      status: 'online',
      lastSeen: receivedAt.toISOString(),
      timestamp: receivedAt.toISOString(),
    });
    logger.info({ deviceId }, 'Device back online');
  }

  return {
    deviceId,
    status: 'online',
    lastSeen: receivedAt.toISOString(),
    reconnectDetected: wasOffline,
    nextHeartbeatSeconds: env.DEVICE_HEARTBEAT_INTERVAL_SECONDS,
  };
}

export type { PostureLabel };
