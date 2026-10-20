import { useCallback, useEffect, useRef } from 'react';
import { BleManager } from '../services/ble/BleManager';
import { BleProtocol } from '../services/ble/BleProtocol';
import { useCalibrationStore } from '../store/calibrationStore';
import { useDeviceStore } from '../store/deviceStore';
import { ConnectionState } from '../types/device';
import { CalibrationTimeoutMs } from '../services/ble/BleConfig';

/**
 * Calibration workflow hook.
 *
 * CRITICAL: Calibration success is set ONLY when the ESP32 returns a
 * calibration-result notification. The write completing does NOT mean
 * calibration succeeded — the physical sensor calibration is performed by the
 * ESP32, and the app must wait for its acknowledgment.
 */
export function useCalibration() {
  const { status, progress, referenceRoll, referencePitch, lastCalibratedAt, errorMessage, setStatus, setProgress, setResult, setError, reset } =
    useCalibrationStore();
  const connectionState = useDeviceStore((s) => s.connectionState);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startCalibration = useCallback(async () => {
    if (connectionState !== ConnectionState.Connected || !BleManager.isConnected()) {
      setError('Device not connected. Please connect your SmartPosture device first.');
      return;
    }

    reset();
    setStatus('calibrating');
    setProgress(0);

    // Set a timeout in case the device never responds
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'calibrating') {
        setError('Calibration timed out. Please try again.');
        setStatus('timeout');
      }
    }, CalibrationTimeoutMs);

    try {
      await BleProtocol.sendCalibrate();
      // Write completed — but we do NOT mark success here.
      // Success is set by the calibration-result notification handler in
      // BleProtocol (via useCalibrationStore.setResult).
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const message = err instanceof Error ? err.message : 'Failed to send calibration command';
      setError(message);
      setStatus('error');
    }
  }, [connectionState, reset, setError, setProgress, setStatus]);

  const cancelCalibration = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('cancelled');
    setProgress(0);
  }, [setStatus, setProgress]);

  const recalibrate = useCallback(() => {
    reset();
    void startCalibration();
  }, [reset, startCalibration]);

  return {
    status,
    progress,
    referenceRoll,
    referencePitch,
    lastCalibratedAt,
    errorMessage,
    startCalibration,
    cancelCalibration,
    recalibrate,
    reset,
  };
}
