import { z } from 'zod';

/**
 * Shared domain vocabulary for the SmartPosture backend.
 * Keeping the enums in a single place avoids drift between validation,
 * persistence and socket payloads.
 */

export const POSTURE_LABELS = [
  'GOOD_POSTURE',
  'SLOUCHING',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'HEAD_FORWARD',
  'UNKNOWN',
] as const;

export const postureLabelSchema = z.enum(POSTURE_LABELS);
export type PostureLabel = (typeof POSTURE_LABELS)[number];

export const EVENT_TYPES = [
  'POSTURE_INCORRECT',
  'VIBRATION_ALERT',
  'DEVICE_DISCONNECTED',
  'DEVICE_RECONNECTED',
  'LOW_BATTERY',
  'SENSOR_ERROR',
] as const;

export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export const eventSeveritySchema = z.enum(EVENT_SEVERITIES);
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const DEVICE_STATUSES = ['online', 'offline', 'unknown'] as const;
export const deviceStatusSchema = z.enum(DEVICE_STATUSES);
export type DeviceStatusValue = (typeof DEVICE_STATUSES)[number];

export const DEFAULT_EVENT_SEVERITY: Record<EventType, EventSeverity> = {
  POSTURE_INCORRECT: 'warning',
  VIBRATION_ALERT: 'warning',
  DEVICE_DISCONNECTED: 'warning',
  DEVICE_RECONNECTED: 'info',
  LOW_BATTERY: 'warning',
  SENSOR_ERROR: 'critical',
};

/** A posture is only "good" when the ESP32 explicitly classified it as such. */
export function isGoodPosture(label: PostureLabel | null | undefined): boolean {
  return label === 'GOOD_POSTURE';
}

/**
 * `UNKNOWN` means the device could not classify the posture. Its monitored time
 * is intentionally excluded from both good and bad durations instead of being
 * silently counted as incorrect posture.
 */
export function isBadPosture(label: PostureLabel | null | undefined): boolean {
  if (!label) {
    return false;
  }
  return label !== 'GOOD_POSTURE' && label !== 'UNKNOWN';
}
