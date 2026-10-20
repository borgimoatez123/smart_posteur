import { Telemetry } from '../../modules/telemetry/telemetry.model';
import type { PostureLabel } from '../../shared/domain';
import { TEST_DEVICE_ID } from './test-db';

export interface SampleInput {
  label: PostureLabel;
  angle: number;
  at: Date;
  deviceId?: string;
  alert?: boolean;
  battery?: number | null;
  sessionId?: string | null;
  sensors?: Record<string, number> | null;
}

/**
 * Inserts a telemetry document directly, bypassing the HTTP layer.
 *
 * Read-only endpoints (dashboard, history, sessions) are then tested against a
 * predictable dataset instead of one produced by ingestion side effects.
 * The `:fixture` suffix keeps these keys from ever colliding with keys built by
 * the ingestion path.
 */
export async function insertTelemetrySample(input: SampleInput) {
  const deviceId = input.deviceId ?? TEST_DEVICE_ID;
  return Telemetry.create({
    deviceId,
    timestamp: input.at,
    sensors: input.sensors ?? null,
    posture: {
      label: input.label,
      angle: input.angle,
      confidence: null,
      badDurationSeconds: null,
    },
    alert: input.alert ?? false,
    battery: input.battery ?? null,
    sensorError: false,
    sessionId: input.sessionId ?? null,
    samplingHz: 10,
    dedupeKey: `${deviceId}:${input.at.toISOString()}:${input.label}:${input.alert ? 'alert' : 'ok'}:fixture`,
  });
}
