import { useCallback, useEffect, useRef } from 'react';
import { BleManager } from '../services/ble/BleManager';
import { useDeviceStore } from '../store/deviceStore';
import { usePostureStore } from '../store/postureStore';
import { ConnectionState } from '../types/device';
import { requestBlePermissions } from '../utils/blePermissions';

/**
 * Hook for BLE device scanning, connection, and disconnection lifecycle.
 *
 * Connection state is derived from the actual `react-native-ble-plx` connection
 * state — the app never claims "Connected" unless the BLE connect succeeded.
 */
export function useBleDevice() {
  const {
    connectionState,
    setConnectionState,
    scanResults,
    addScanResult,
    setScanResults,
    isScanning,
    setScanning,
    setSelectedDevice,
    setError,
  } = useDeviceStore();

  const disconnectHandlerRef = useRef<(() => void) | null>(null);

  const startScan = useCallback(async () => {
    const granted = await requestBlePermissions();
    if (!granted) {
      setError('Bluetooth permissions are required to scan for devices.');
      return;
    }

    setError(null);
    setScanning(true);
    setScanResults([]);

    BleManager.startScan((error, device) => {
      if (error) {
        setError(error.message);
        setScanning(false);
        return;
      }
      if (device) {
        addScanResult({ id: device.id, name: device.name, rssi: device.rssi });
      }
    });
  }, [addScanResult, setError, setScanResults, setScanning]);

  const stopScan = useCallback(() => {
    BleManager.stopScan();
    setScanning(false);
  }, [setScanning]);

  const connect = useCallback(
    async (deviceId: string, deviceName?: string | null) => {
      setConnectionState(ConnectionState.Connecting);
      setError(null);
      BleManager.stopScan();
      setScanning(false);

      try {
        await BleManager.connect(deviceId);
        setSelectedDevice({
          id: deviceId,
          name: deviceName ?? null,
          rssi: null,
          firmwareVersion: null,
          battery: null,
        });
        setConnectionState(ConnectionState.Connected);

        // Listen for unexpected disconnections
        disconnectHandlerRef.current = BleManager.onDisconnected(() => {
          setConnectionState(ConnectionState.Disconnected);
          setSelectedDevice(null);
          usePostureStore.getState().reset();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setError(message);
        setConnectionState(ConnectionState.Disconnected);
        setSelectedDevice(null);
      }
    },
    [setConnectionState, setError, setScanning, setSelectedDevice],
  );

  const disconnect = useCallback(async () => {
    setConnectionState(ConnectionState.Disconnecting);
    try {
      await BleManager.disconnect();
    } catch {
      // ignore
    }
    if (disconnectHandlerRef.current) {
      disconnectHandlerRef.current();
      disconnectHandlerRef.current = null;
    }
    setConnectionState(ConnectionState.Disconnected);
    setSelectedDevice(null);
    usePostureStore.getState().reset();
  }, [setConnectionState, setSelectedDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      BleManager.stopScan();
      if (disconnectHandlerRef.current) {
        disconnectHandlerRef.current();
      }
    };
  }, []);

  return {
    connectionState,
    scanResults,
    isScanning,
    startScan,
    stopScan,
    connect,
    disconnect,
  };
}
