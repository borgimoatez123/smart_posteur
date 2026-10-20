import { z } from 'zod';
import { PostureClass } from '../types/posture';
import { BleProtocolVersion } from '../services/ble/BleConfig';

/**
 * Strict schema validation for BLE payloads.
 *
 * Every inbound payload is validated against a Zod schema before being written
 * to any store. Malformed payloads are rejected (and logged) so the UI never
 * receives undefined-shape data.
 */

const PostureClassSchema = z.nativeEnum(PostureClass);

/**
 * Live posture measurement schema.
 * Optional fields (confidence, battery) are nullable — null means the firmware
 * does not provide them, and the UI must render them as unavailable.
 */
export const LivePostureMeasurementSchema = z.object({
  version: z.number().int().positive(),
  posture: PostureClassSchema,
  roll: z.number(),
  pitch: z.number(),
  confidence: z.number().nullable(),
  bad_duration: z.number().int().nonnegative(),
  battery: z.number().int().min(0).max(100).nullable(),
  alert: z.boolean(),
  timestamp: z.number().int().positive(),
});

export type ValidatedLivePostureMeasurement = z.infer<
  typeof LivePostureMeasurementSchema
>;

/** Device status / battery schema. */
export const DeviceStatusSchema = z.object({
  version: z.number().int().positive().optional(),
  firmwareVersion: z.string().nullable().optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
  rssi: z.number().nullable().optional(),
});

/** Calibration result schema from the ESP32. */
export const CalibrationResultSchema = z.object({
  success: z.boolean(),
  referenceRoll: z.number().nullable(),
  referencePitch: z.number().nullable(),
  timestamp: z.number().int().positive(),
  error: z.string().optional(),
});

/** Alert config acknowledgment schema. */
export const AlertConfigAckSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  persistenceDelay: z.number().int().positive().optional(),
  vibrationEnabled: z.boolean().optional(),
  error: z.string().optional(),
});

/**
 * Parse and validate a raw JSON string received over BLE.
 * Returns the parsed object or throws a ZodError if invalid.
 */
export function parseJsonPayload<T>(raw: string, schema: z.ZodSchema<T>): T {
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}

/**
 * Safely parse a live posture measurement. Returns null on failure.
 */
export function tryParseLivePosture(
  raw: string,
): ValidatedLivePostureMeasurement | null {
  try {
    return parseJsonPayload(raw, LivePostureMeasurementSchema);
  } catch {
    return null;
  }
}

export { BleProtocolVersion };
