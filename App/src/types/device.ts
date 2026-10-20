export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Disconnecting = 'Disconnecting',
}

export interface DeviceInfo {
  id: string;
  name: string | null;
  rssi: number | null;
  firmwareVersion: string | null;
  battery: number | null;
}

export interface ScanResult {
  id: string;
  name: string | null;
  rssi: number | null;
}
