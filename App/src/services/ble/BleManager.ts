import { BleManager as PlxBleManager, Device, Characteristic, Subscription } from 'react-native-ble-plx';
import {
  BleServiceUuid,
  BleCharacteristicUuids,
  BleDeviceNamePrefix,
} from './BleConfig';
import type { BleDiscoveredDevice } from '../../types/ble';

type ScanListener = (error: Error | null, device: BleDiscoveredDevice | null) => void;
type NotificationListener = (characteristicUuid: string, value: string | null) => void;
type DisconnectListener = (deviceId: string) => void;

/**
 * Dedicated BLE service layer.
 *
 * This is the ONLY module that talks to react-native-ble-plx directly. UI
 * components and hooks must go through this manager (or the BleProtocol layer)
 * and never call the BLE library themselves.
 */
class BleManagerService {
  private manager: PlxBleManager | null = null;
  private connectedDevice: Device | null = null;
  private characteristics: Map<string, Characteristic> = new Map();
  private scanning = false;
  private notificationSubscriptions: Map<string, Subscription> = new Map();
  private disconnectSubscription: Subscription | null = null;
  private disconnectListeners: Set<DisconnectListener> = new Set();
  private notificationListeners: Set<NotificationListener> = new Set();
  private isInitialized = false;

  /** Lazily create the native BleManager. */
  private getManager(): PlxBleManager {
    if (!this.manager) {
      this.manager = new PlxBleManager();
    }
    return this.manager;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.getManager();
    this.isInitialized = true;
  }

  /**
   * Start scanning for SmartPosture devices.
   * Only devices whose name starts with the configured prefix are reported.
   */
  startScan(listener: ScanListener): void {
    const mgr = this.getManager();
    if (this.scanning) {
      this.stopScan();
    }
    this.scanning = true;
    void mgr.startDeviceScan(
      [BleServiceUuid],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          listener(error, null);
          return;
        }
        if (!device) return;
        const name = device.name ?? device.localName ?? null;
        if (name && !name.startsWith(BleDeviceNamePrefix)) {
          return; // Not a SmartPosture device
        }
        listener(null, {
          id: device.id,
          name: name ?? `Device ${device.id.slice(-4)}`,
          rssi: device.rssi ?? null,
        });
      },
    );
  }

  stopScan(): void {
    if (this.manager && this.scanning) {
      void this.manager.stopDeviceScan();
    }
    this.scanning = false;
  }

  /**
   * Connect to a device and discover services/characteristics.
   * Resolves only when the connection and discovery succeed.
   */
  async connect(deviceId: string): Promise<void> {
    const mgr = this.getManager();
    this.stopScan();

    const device = await mgr.connectToDevice(deviceId);
    this.connectedDevice = device;

    // Register disconnect listener
    this.disconnectSubscription = device.onDisconnected((error) => {
      const id = device.id;
      this.cleanupDevice();
      this.disconnectListeners.forEach((l) => l(id));
      if (error) {
        console.warn('[BleManager] unexpected disconnect:', error);
      }
    });

    await device.discoverAllServicesAndCharacteristics();

    // Cache characteristics for our service
    const services = await device.services();
    const targetService = services.find((s) => s.uuid === BleServiceUuid);
    if (targetService) {
      const chars = await targetService.characteristics();
      for (const c of chars) {
        this.characteristics.set(c.uuid, c);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch {
        // ignore
      }
    }
    this.cleanupDevice();
  }

  private cleanupDevice(): void {
    this.notificationSubscriptions.forEach((sub) => sub.remove());
    this.notificationSubscriptions.clear();
    if (this.disconnectSubscription) {
      this.disconnectSubscription.remove();
      this.disconnectSubscription = null;
    }
    this.connectedDevice = null;
    this.characteristics.clear();
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDevice?.id ?? null;
  }

  /**
   * Subscribe to notifications for a characteristic.
   * Throws if the characteristic is not found on the connected device.
   */
  async subscribeToCharacteristic(
    characteristicUuid: string,
    listener: NotificationListener,
  ): Promise<void> {
    const device = this.connectedDevice;
    if (!device) {
      throw new Error('No device connected');
    }
    const char = this.characteristics.get(characteristicUuid);
    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found on device`);
    }

    this.notificationListeners.add(listener);

    if (this.notificationSubscriptions.has(characteristicUuid)) {
      return; // already subscribed
    }

    const sub = char.monitor((error, characteristic) => {
      if (error) {
        console.warn(`[BleManager] notification error on ${characteristicUuid}:`, error);
        return;
      }
      if (!characteristic) return;
      const value = characteristic.value;
      let decoded: string | null = null;
      if (value) {
        try {
          decoded = Buffer.from(value, 'base64').toString('utf-8');
        } catch {
          decoded = null;
        }
      }
      this.notificationListeners.forEach((l) => l(characteristic.uuid, decoded));
    });

    this.notificationSubscriptions.set(characteristicUuid, sub);
  }

  /**
   * Write a command to a characteristic (with response).
   */
  async writeCommand(characteristicUuid: string, data: string): Promise<void> {
    const device = this.connectedDevice;
    if (!device) {
      throw new Error('No device connected');
    }
    const char = this.characteristics.get(characteristicUuid);
    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found on device`);
    }
    const base64 = Buffer.from(data, 'utf-8').toString('base64');
    await char.writeWithResponse(base64);
  }

  /**
   * Read a characteristic value.
   */
  async readCharacteristic(characteristicUuid: string): Promise<string | null> {
    const device = this.connectedDevice;
    if (!device) {
      throw new Error('No device connected');
    }
    const char = this.characteristics.get(characteristicUuid);
    if (!char) {
      throw new Error(`Characteristic ${characteristicUuid} not found on device`);
    }
    const read = await char.read();
    if (!read.value) return null;
    return Buffer.from(read.value, 'base64').toString('utf-8');
  }

  onDisconnected(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  removeNotificationListener(listener: NotificationListener): void {
    this.notificationListeners.delete(listener);
  }

  /**
   * Full cleanup — call when the app is shutting down or BLE is no longer needed.
   */
  destroy(): void {
    this.stopScan();
    this.disconnect().catch(() => undefined);
    this.notificationListeners.clear();
    this.disconnectListeners.clear();
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
    this.isInitialized = false;
  }

  get characteristicUuids() {
    return BleCharacteristicUuids;
  }
}

export const BleManager = new BleManagerService();
