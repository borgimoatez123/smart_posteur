import { DEVICE_ID } from '../config/appConfig';
import { apiRequest } from './client';
import { endpoints } from './endpoints';
import type { DeviceListResponse, DeviceStatusView, DeviceView } from './types';

/** `GET /api/v1/devices` */
export function listDevices(signal?: AbortSignal): Promise<DeviceListResponse> {
  return apiRequest<DeviceListResponse>(endpoints.devices, { signal });
}

/** `GET /api/v1/devices/:deviceId` */
export function getDevice(deviceId: string = DEVICE_ID, signal?: AbortSignal): Promise<DeviceView> {
  return apiRequest<DeviceView>(endpoints.device(deviceId), { signal });
}

/**
 * `GET /api/v1/devices/:deviceId/status`
 *
 * The authoritative source for `online` / `offline` / `unknown`. The mobile app
 * never infers device connectivity from its own reachability of the backend.
 */
export function getDeviceStatus(
  deviceId: string = DEVICE_ID,
  signal?: AbortSignal,
): Promise<DeviceStatusView> {
  return apiRequest<DeviceStatusView>(endpoints.deviceStatus(deviceId), { signal });
}
