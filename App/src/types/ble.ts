import type { PostureClass } from './posture';

/**
 * BLE protocol command identifiers sent to the ESP32.
 *
 * These are proposed placeholders. Final values must match the ESP32 firmware.
 */
export enum BleCommandType {
  CALIBRATE = 'CALIBRATE',
  SET_ALERT_CONFIG = 'SET_ALERT_CONFIG',
  HAPTIC_TEST = 'HAPTIC_TEST',
}

/** Calibration result received from the ESP32. */
export interface CalibrationResult {
  success: boolean;
  /** Reference roll angle in degrees. */
  referenceRoll: number | null;
  /** Reference pitch angle in degrees. */
  referencePitch: number | null;
  /** Calibration timestamp (epoch ms). */
  timestamp: number;
  error?: string;
}

/** Alert configuration sent to / received from the ESP32. */
export interface AlertConfigPayload {
  /** Poor-posture persistence delay before a vibration alert, in seconds. */
  persistenceDelay: number;
  vibrationEnabled: boolean;
  /** Alert sensitivity 0..100. Only honored if firmware supports it. */
  sensitivity: number | null;
}

/** Union of all inbound BLE notification payloads. */
export type BleNotification =
  | { kind: 'posture'; data: unknown }
  | { kind: 'device_status'; data: unknown }
  | { kind: 'calibration_result'; data: unknown }
  | { kind: 'alert_config_ack'; data: unknown };

/** A discovered BLE device. */
export interface BleDiscoveredDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

export { PostureClass };
