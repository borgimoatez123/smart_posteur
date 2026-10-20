/**
 * Presentation vocabulary for backend enums.
 *
 * The backend values (`GOOD_POSTURE`, `VIBRATION_ALERT`, …) are preserved
 * internally; only the rendered label is human readable.
 */
import { PostureClass, POSTURE_COLOR_MAP, type PostureClassColor } from '../types/posture';
import type {
  DeviceStatus,
  EventSeverity,
  EventType,
  LiveDataQuality,
  LiveRecommendationSource,
  RecommendationPriority,
  RecommendationStatus,
} from '../api/types';

export type Tone = PostureClassColor;

/** Human readable posture labels (UI only — the raw value is never changed). */
export const POSTURE_LABEL: Record<PostureClass, string> = {
  [PostureClass.GOOD_POSTURE]: 'Good posture',
  [PostureClass.SLOUCHING]: 'Slouching',
  [PostureClass.LEAN_LEFT]: 'Leaning left',
  [PostureClass.LEAN_RIGHT]: 'Leaning right',
  [PostureClass.HEAD_FORWARD]: 'Head forward',
  [PostureClass.UNKNOWN]: 'User moves right now',
};

/** Short labels for dense lists and charts. */
export const POSTURE_SHORT_LABEL: Record<PostureClass, string> = {
  [PostureClass.GOOD_POSTURE]: 'Good',
  [PostureClass.SLOUCHING]: 'Slouch',
  [PostureClass.LEAN_LEFT]: 'Lean L',
  [PostureClass.LEAN_RIGHT]: 'Lean R',
  [PostureClass.HEAD_FORWARD]: 'Head Fwd',
  [PostureClass.UNKNOWN]: 'User moves right now',
};

export const POSTURE_TONE: Record<PostureClass, Tone> = POSTURE_COLOR_MAP;

const POSTURE_VALUES = new Set<string>(Object.values(PostureClass));

/** Safely narrows an untrusted string to a known posture label. */
export function parsePostureLabel(value: unknown): PostureClass | null {
  if (typeof value !== 'string') return null;
  return POSTURE_VALUES.has(value) ? (value as PostureClass) : null;
}

/** Rendered when a posture value is missing or unrecognised. */
export const UNKNOWN_POSTURE_LABEL = 'Unknown posture';

/** Legacy spelling still present in older stored records. */
const LEGACY_UNCLASSIFIED = 'UNCLASSIFIED';

/**
 * Single source of truth for rendering a posture value.
 *
 * `UNKNOWN` — and the legacy `UNCLASSIFIED` spelling — reads as
 * "User moves right now".
 *
 * This is a display label only. It is NOT a verified classification, it does
 * not claim that movement was measured, and it is never counted as good or bad
 * posture. Unrecognised values fall back to a neutral label rather than leaking
 * a raw enum name into the UI.
 */
export function getPostureDisplayLabel(posture: unknown): string {
  if (typeof posture !== 'string') return UNKNOWN_POSTURE_LABEL;
  const trimmed = posture.trim();
  if (trimmed.length === 0) return UNKNOWN_POSTURE_LABEL;
  if (trimmed === LEGACY_UNCLASSIFIED) return POSTURE_LABEL[PostureClass.UNKNOWN];
  const parsed = parsePostureLabel(trimmed);
  return parsed === null ? UNKNOWN_POSTURE_LABEL : POSTURE_LABEL[parsed];
}

/**
 * `UNKNOWN` means "the device could not classify". It is never counted as good
 * or bad posture. Internal logic only — UI text uses `getPostureDisplayLabel`.
 */
export function isUnclassified(label: PostureClass | null): boolean {
  return label === PostureClass.UNKNOWN;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  POSTURE_INCORRECT: 'Incorrect posture',
  VIBRATION_ALERT: 'Vibration alert',
  DEVICE_DISCONNECTED: 'Device disconnected',
  DEVICE_RECONNECTED: 'Device reconnected',
  LOW_BATTERY: 'Low battery',
  SENSOR_ERROR: 'Sensor error',
};

/**
 * Explains how each event differs from a raw posture measurement, so the UI can
 * keep measurements, posture alerts and vibration events distinct.
 */
export const EVENT_TYPE_DESCRIPTION: Record<EventType, string> = {
  POSTURE_INCORRECT: 'The wearable classified a measurement as incorrect posture.',
  VIBRATION_ALERT: 'The wearable actually triggered its vibration motor.',
  DEVICE_DISCONNECTED: 'The backend stopped receiving heartbeats/telemetry from the device.',
  DEVICE_RECONNECTED: 'The device resumed sending heartbeats after being offline.',
  LOW_BATTERY: 'The device reported a low battery level.',
  SENSOR_ERROR: 'The device reported a sensor (MPU6050) error.',
};

export const EVENT_SEVERITY_LABEL: Record<EventSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export const EVENT_SEVERITY_TONE: Record<EventSeverity, Tone> = {
  info: 'neutral',
  warning: 'warning',
  critical: 'danger',
};

export const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
};

export const PRIORITY_TONE: Record<RecommendationPriority, Tone> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
};

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  unknown: 'Unknown',
};

export const DEVICE_STATUS_TONE: Record<DeviceStatus, Tone> = {
  online: 'good',
  offline: 'danger',
  unknown: 'neutral',
};

export const RECOMMENDATION_STATUS_LABEL: Record<RecommendationStatus, string> = {
  success: 'Generated',
  error: 'Failed',
  unavailable: 'Unavailable',
};

/* ------------------------------------------------------------------ */
/* Live AI recommendations                                             */
/* ------------------------------------------------------------------ */

export const LIVE_QUALITY_LABEL: Record<LiveDataQuality, string> = {
  none: 'No data',
  limited: 'Limited data',
  recent: 'Recent data',
  established: 'Established data',
};

export const LIVE_QUALITY_TONE: Record<LiveDataQuality, Tone> = {
  none: 'neutral',
  limited: 'warning',
  recent: 'good',
  established: 'good',
};

/** Explains what the quality label means, so "limited" is never read as failure. */
export const LIVE_QUALITY_HINT: Record<LiveDataQuality, string> = {
  none: 'The backend received no measurement inside the analysed window.',
  limited:
    'Only a few measurements were received in the window, so this is a rough impression rather than a trend.',
  recent:
    'Enough measurements for a recent snapshot; no long-term trend is claimed from this window.',
  established: 'Enough measurements over a long enough window to support a trend.',
};

export const LIVE_SOURCE_LABEL: Record<LiveRecommendationSource, string> = {
  gemini: 'Gemini coaching',
  fallback: 'Backend coaching',
  none: 'No advice',
};

export const LIVE_SOURCE_TONE: Record<LiveRecommendationSource, Tone> = {
  gemini: 'good',
  fallback: 'warning',
  none: 'neutral',
};
