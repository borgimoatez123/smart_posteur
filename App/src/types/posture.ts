/**
 * Posture classification types.
 *
 * The ESP32 wearable is responsible for posture inference. The mobile app only
 * displays the class it receives and never classifies sensor data itself.
 */

export enum PostureClass {
  GOOD_POSTURE = 'GOOD_POSTURE',
  SLOUCHING = 'SLOUCHING',
  LEAN_LEFT = 'LEAN_LEFT',
  LEAN_RIGHT = 'LEAN_RIGHT',
  HEAD_FORWARD = 'HEAD_FORWARD',
  UNKNOWN = 'UNKNOWN',
}

/**
 * A single live posture measurement streamed from the ESP32 over BLE.
 *
 * Optional fields (confidence, battery) are nullable: when the firmware does
 * not provide them, they MUST be `null` and rendered as unavailable, never 0.
 */
export interface LivePostureMeasurement {
  version: number;
  posture: PostureClass;
  /** Relative roll angle in degrees. */
  roll: number;
  /** Relative pitch angle in degrees. */
  pitch: number;
  /** Classification confidence 0..1, or null when not provided by firmware. */
  confidence: number | null;
  /** Duration of the current poor-posture episode in milliseconds. */
  bad_duration: number;
  /** Battery percentage 0..100, or null when not provided. */
  battery: number | null;
  /** Whether a haptic alert is currently active. */
  alert: boolean;
  /** Device-side epoch milliseconds. */
  timestamp: number;
}

export type PostureClassColor = 'good' | 'warning' | 'danger' | 'neutral';

export const POSTURE_COLOR_MAP: Record<PostureClass, PostureClassColor> = {
  [PostureClass.GOOD_POSTURE]: 'good',
  [PostureClass.SLOUCHING]: 'danger',
  [PostureClass.LEAN_LEFT]: 'warning',
  [PostureClass.LEAN_RIGHT]: 'warning',
  [PostureClass.HEAD_FORWARD]: 'warning',
  [PostureClass.UNKNOWN]: 'neutral',
};

/** A contiguous segment of a single posture class, used for history. */
export interface PostureEpisode {
  posture: PostureClass;
  /** Episode start epoch ms. */
  startedAt: number;
  /** Episode end epoch ms, or null if ongoing. */
  endedAt: number | null;
  /** Duration in seconds (computed). */
  durationSeconds: number;
}

/** A persisted daily posture session record. */
export interface PostureSession {
  date: string; // YYYY-MM-DD local date key
  episodes: PostureEpisode[];
  alertCount: number;
}
