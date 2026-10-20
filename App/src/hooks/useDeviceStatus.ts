import { getDeviceStatus } from '../api/deviceApi';
import type { DeviceStatusView } from '../api/types';
import { DEVICE_ID, STATUS_POLL_INTERVAL_MS } from '../config/appConfig';
import { useResource, type ResourceState } from './useResource';

/**
 * Wearable status from `GET /devices/:deviceId/status`.
 *
 * This is the ONLY source of truth for `online` / `offline` / `unknown`. Phone
 * reachability of the backend never implies the wearable is online.
 */
export function useDeviceStatus(
  deviceId: string = DEVICE_ID,
  enabled = true,
): ResourceState<DeviceStatusView> {
  return useResource<DeviceStatusView>((signal) => getDeviceStatus(deviceId, signal), {
    enabled,
    pollMs: STATUS_POLL_INTERVAL_MS,
    deps: [deviceId],
  });
}
