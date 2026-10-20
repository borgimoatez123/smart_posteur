/**
 * Central BLE configuration.
 *
 * All service and characteristic UUIDs are PLACEHOLDERS. They MUST be replaced
 * with the actual values defined by the ESP32 firmware once the protocol is
 * finalized. No UUID literals should appear anywhere else in the codebase.
 */

export const BleServiceUuid = '00000000-0000-0000-0000-000000000000';

export const BleCharacteristicUuids = {
  /** Live posture measurements (notify). */
  postureMeasurement: '00000000-0000-0000-0000-000000000001',
  /** Device status / battery level (notify / read). */
  deviceStatus: '00000000-0000-0000-0000-000000000002',
  /** Calibration command (write) and result (notify). */
  calibration: '00000000-0000-0000-0000-000000000003',
  /** Alert configuration (write) and acknowledgment (notify). */
  alertConfig: '00000000-0000-0000-0000-000000000004',
  /** Haptic test command (write). Optional — only if firmware supports it). */
  hapticTest: '00000000-0000-0000-0000-000000000005',
} as const;

/** Device name filter used during scanning. Adjust to match the firmware. */
export const BleDeviceNamePrefix = 'SmartPosture';

/** Protocol version for the JSON payload exchanged with the device. */
export const BleProtocolVersion = 1;

/** Calibration timeout (ms). If no ack is received, calibration fails. */
export const CalibrationTimeoutMs = 15000;

/** Default command write timeout (ms). */
export const CommandWriteTimeoutMs = 5000;

export type BleCharacteristicKey = keyof typeof BleCharacteristicUuids;
