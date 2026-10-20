import { getHealth } from '../api/healthApi';
import type { HealthResponse } from '../api/types';
import { HEALTH_POLL_INTERVAL_MS } from '../config/appConfig';
import { useResource, type ResourceState } from './useResource';

/**
 * Backend + database connectivity, polled slowly.
 * `error` means the backend is unreachable; a successful `data` with
 * `status: 'degraded'` means the backend is up but MongoDB is not.
 */
export function useBackendHealth(): ResourceState<HealthResponse> {
  return useResource<HealthResponse>((signal) => getHealth(signal), {
    pollMs: HEALTH_POLL_INTERVAL_MS,
  });
}
