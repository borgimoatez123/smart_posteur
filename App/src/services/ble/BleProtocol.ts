import { BleManager } from './BleManager';
import { BleCharacteristicUuids, BleProtocolVersion } from './BleConfig';
import {
  LivePostureMeasurementSchema,
  DeviceStatusSchema,
  CalibrationResultSchema,
  AlertConfigAckSchema,
  tryParseLivePosture,
  type ValidatedLivePostureMeasurement,
} from '../../utils/validation';
import type { AlertConfigPayload, CalibrationResult } from '../../types/ble';
import { usePostureStore } from '../../store/postureStore';
import { useDeviceStore } from '../../store/deviceStore';
import { useCalibrationStore } from '../../store/calibrationStore';

type NotificationHandler = (characteristicUuid: string, value: string | null) => void;

/**
 * BLE protocol layer.
 *
 * Encodes commands to send to the ESP32 and decodes inbound notifications.
 * All inbound data is validated with Zod before reaching the stores.
 */
export const BleProtocol = {
  /**
   * Subscribe to all relevant characteristics and route notifications to stores.
   * Returns an unsubscribe function.
   */
  async subscribeAll(): Promise<() => void> {
    const handler: NotificationHandler = (uuid, value) => {
      if (value === null) return;
      switch (uuid) {
        case BleCharacteristicUuids.postureMeasurement:
          handlePostureMeasurement(value);
          break;
        case BleCharacteristicUuids.deviceStatus:
          handleDeviceStatus(value);
          break;
        case BleCharacteristicUuids.calibration:
          handleCalibrationResult(value);
          break;
        case BleCharacteristicUuids.alertConfig:
          handleAlertConfigAck(value);
          break;
        default:
          // Unknown characteristic — ignore
          break;
      }
    };

    const subscriptions = [
      BleCharacteristicUuids.postureMeasurement,
      BleCharacteristicUuids.deviceStatus,
      BleCharacteristicUuids.calibration,
      BleCharacteristicUuids.alertConfig,
    ];

    for (const uuid of subscriptions) {
      try {
        await BleManager.subscribeToCharacteristic(uuid, handler);
      } catch (err) {
        // Characteristic may not be supported by this firmware version.
        console.warn(`[BleProtocol] could not subscribe to ${uuid}:`, err);
      }
    }

    return () => {
      BleManager.removeNotificationListener(handler);
    };
  },

  /** Send a calibration command to the ESP32. */
  async sendCalibrate(): Promise<void> {
    const payload = JSON.stringify({
      version: BleProtocolVersion,
      command: 'CALIBRATE',
    });
    await BleManager.writeCommand(BleCharacteristicUuids.calibration, payload);
  },

  /** Send alert configuration to the ESP32. */
  async sendAlertConfig(config: AlertConfigPayload): Promise<void> {
    const payload = JSON.stringify({
      version: BleProtocolVersion,
      command: 'SET_ALERT_CONFIG',
      ...config,
    });
    await BleManager.writeCommand(BleCharacteristicUuids.alertConfig, payload);
  },

  /** Send a haptic test command. Optional — firmware may not support it. */
  async sendHapticTest(): Promise<void> {
    const payload = JSON.stringify({
      version: BleProtocolVersion,
      command: 'HAPTIC_TEST',
    });
    await BleManager.writeCommand(BleCharacteristicUuids.hapticTest, payload);
  },
};

function handlePostureMeasurement(value: string): void {
  const measurement = tryParseLivePosture(value);
  if (!measurement) {
    console.warn('[BleProtocol] invalid posture payload:', value);
    return;
  }
  usePostureStore.getState().setMeasurement(measurement as ValidatedLivePostureMeasurement, false);
}

function handleDeviceStatus(value: string): void {
  try {
    const parsed = JSON.parse(value);
    const status = DeviceStatusSchema.parse(parsed);
    if (status.battery !== undefined && status.battery !== null) {
      useDeviceStore.getState().setBattery(status.battery);
    }
    if (status.firmwareVersion) {
      useDeviceStore.getState().setFirmwareVersion(status.firmwareVersion);
    }
  } catch (err) {
    console.warn('[BleProtocol] invalid device status payload:', err);
  }
}

function handleCalibrationResult(value: string): void {
  try {
    const parsed = JSON.parse(value);
    const result = CalibrationResultSchema.parse(parsed) as CalibrationResult;
    const store = useCalibrationStore.getState();
    if (result.success) {
      store.setResult(result.referenceRoll, result.referencePitch, result.timestamp);
    } else {
      store.setError(result.error ?? 'Calibration failed');
    }
  } catch (err) {
    console.warn('[BleProtocol] invalid calibration result:', err);
  }
}

function handleAlertConfigAck(value: string): void {
  try {
    const parsed = JSON.parse(value);
    const ack = AlertConfigAckSchema.parse(parsed);
    if (!ack.success) {
      console.warn('[BleProtocol] alert config not applied:', ack.error);
    }
  } catch (err) {
    console.warn('[BleProtocol] invalid alert config ack:', err);
  }
}
