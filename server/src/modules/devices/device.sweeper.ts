import { Device } from './device.model';
import { createEvent } from '../events/event.service';
import { emitDeviceStatus } from '../../sockets/socket.server';
import { deviceOfflineTimeoutMs, env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface SweepResult {
  candidates: number;
  disconnectedDevices: string[];
}

/**
 * Detects devices that stopped reporting.
 *
 * Only a real transition (online -> offline) creates a `DEVICE_DISCONNECTED`
 * event: the conditional update guarantees an event is stored once per
 * disconnection even if two sweeps overlap.
 */
export async function sweepDeviceStatuses(now: Date = new Date()): Promise<SweepResult> {
  const cutoff = new Date(now.getTime() - deviceOfflineTimeoutMs);

  const candidates = await Device.find({
    status: { $ne: 'offline' },
    lastSeen: { $lt: cutoff },
  })
    .select('deviceId lastSeen')
    .lean();

  const disconnectedDevices: string[] = [];

  for (const candidate of candidates) {
    const update = await Device.updateOne(
      { _id: candidate._id, status: { $ne: 'offline' } },
      { $set: { status: 'offline' } },
    );

    if (update.modifiedCount !== 1) {
      continue;
    }

    const lastSeen = candidate.lastSeen ?? null;
    disconnectedDevices.push(candidate.deviceId);

    await createEvent({
      deviceId: candidate.deviceId,
      type: 'DEVICE_DISCONNECTED',
      timestamp: now,
      metadata: { lastSeen: lastSeen ? lastSeen.toISOString() : null },
    });

    emitDeviceStatus({
      deviceId: candidate.deviceId,
      status: 'offline',
      lastSeen: lastSeen ? lastSeen.toISOString() : null,
      timestamp: now.toISOString(),
    });

    logger.warn({ deviceId: candidate.deviceId, lastSeen }, 'Device went offline');
  }

  return { candidates: candidates.length, disconnectedDevices };
}

export function resolveSweepIntervalMs(): number {
  const half = Math.floor(deviceOfflineTimeoutMs / 2);
  return Math.max(5_000, Math.min(half, env.DEVICE_HEARTBEAT_INTERVAL_SECONDS * 1000));
}

export function startDeviceStatusSweeper(intervalMs: number = resolveSweepIntervalMs()): NodeJS.Timeout {
  const timer = setInterval(() => {
    void sweepDeviceStatuses().catch((error: unknown) => {
      logger.error({ err: error }, 'Device status sweep failed');
    });
  }, intervalMs);

  timer.unref();
  return timer;
}
