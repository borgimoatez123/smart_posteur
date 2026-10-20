import { create } from 'zustand';
import { ConnectionState } from '../types/device';
import type { DeviceInfo, ScanResult } from '../types/device';

interface DeviceStoreState {
  connectionState: ConnectionState;
  selectedDevice: DeviceInfo | null;
  scanResults: ScanResult[];
  isScanning: boolean;
  error: string | null;

  setConnectionState: (state: ConnectionState) => void;
  setSelectedDevice: (device: DeviceInfo | null) => void;
  setScanResults: (results: ScanResult[]) => void;
  addScanResult: (result: ScanResult) => void;
  setScanning: (scanning: boolean) => void;
  setError: (error: string | null) => void;
  setBattery: (battery: number | null) => void;
  setFirmwareVersion: (version: string | null) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  connectionState: ConnectionState.Disconnected,
  selectedDevice: null,
  scanResults: [],
  isScanning: false,
  error: null,

  setConnectionState: (connectionState) => set({ connectionState }),
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setScanResults: (scanResults) => set({ scanResults }),
  addScanResult: (result) =>
    set((state) => {
      const exists = state.scanResults.some((r) => r.id === result.id);
      if (exists) {
        return {
          scanResults: state.scanResults.map((r) =>
            r.id === result.id ? result : r,
          ),
        };
      }
      return { scanResults: [...state.scanResults, result] };
    }),
  setScanning: (isScanning) => set({ isScanning }),
  setError: (error) => set({ error }),
  setBattery: (battery) =>
    set((state) => ({
      selectedDevice: state.selectedDevice
        ? { ...state.selectedDevice, battery }
        : null,
    })),
  setFirmwareVersion: (firmwareVersion) =>
    set((state) => ({
      selectedDevice: state.selectedDevice
        ? { ...state.selectedDevice, firmwareVersion }
        : null,
    })),
}));
