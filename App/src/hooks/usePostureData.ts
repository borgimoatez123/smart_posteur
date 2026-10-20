import { useEffect, useRef } from 'react';
import { BleManager } from '../services/ble/BleManager';
import { BleProtocol } from '../services/ble/BleProtocol';
import { useDeviceStore } from '../store/deviceStore';
import { ConnectionState } from '../types/device';

/**
 * Subscribes to live posture data from the ESP32 once a device is connected.
 * Updates are delivered via the posture store; this hook only manages the
 * subscription lifecycle to prevent duplicate subscriptions and leaks.
 */
export function usePostureData() {
  const connectionState = useDeviceStore((s) => s.connectionState);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected && BleManager.isConnected()) {
      // Subscribe to all posture-related notifications
      BleProtocol.subscribeAll()
        .then((unsubscribe) => {
          unsubscribeRef.current = unsubscribe;
        })
        .catch((err) => {
          console.warn('[usePostureData] subscription failed:', err);
        });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [connectionState]);
}
