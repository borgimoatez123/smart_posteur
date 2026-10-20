import { z } from 'zod';
import { postureLabelSchema } from '../../shared/domain';
import { deviceIdSchema, isoTimestampSchema } from '../../utils/validation';

/**
 * MPU6050 physical ranges:
 *  - accelerometer: +/-16 g  ->  +/-160 m/s^2
 *  - gyroscope:     +/-2000 deg/s
 * Values outside those ranges are rejected as malformed.
 */
const accelerometerValue = z
  .number()
  .finite()
  .min(-160, 'accelerometer value must be within +/-160 m/s^2')
  .max(160, 'accelerometer value must be within +/-160 m/s^2')
  .nullable();

const gyroscopeValue = z
  .number()
  .finite()
  .min(-2000, 'gyroscope value must be within +/-2000 deg/s')
  .max(2000, 'gyroscope value must be within +/-2000 deg/s')
  .nullable();

/**
 * Sensor fields are individually optional: the ESP32 may read only a subset
 * (for example when the accelerometer succeeded but the gyroscope read failed).
 */
export const sensorsSchema = z.object({
  ax: accelerometerValue.optional(),
  ay: accelerometerValue.optional(),
  az: accelerometerValue.optional(),
  gx: gyroscopeValue.optional(),
  gy: gyroscopeValue.optional(),
  gz: gyroscopeValue.optional(),
});

export const postureSchema = z.object({
  label: postureLabelSchema,
  angle: z.number().finite().min(-180).max(180),
  confidence: z.number().min(0).max(1).nullable().optional(),
  badDurationSeconds: z.number().min(0).max(86_400).nullable().optional(),
});

export const ingestTelemetryBodySchema = z.object({
  deviceId: deviceIdSchema,
  timestamp: isoTimestampSchema.optional(),
  sensors: sensorsSchema.nullable().optional(),
  posture: postureSchema,
  alert: z.boolean().optional().default(false),
  battery: z.number().int().min(0).max(100).nullable().optional(),
  /** Per-request sampling frequency; falls back to TELEMETRY_SAMPLING_HZ. */
  samplingHz: z.number().positive().max(200).nullable().optional(),
});

export type IngestTelemetryInput = z.infer<typeof ingestTelemetryBodySchema>;
export type SensorsInput = z.infer<typeof sensorsSchema>;
