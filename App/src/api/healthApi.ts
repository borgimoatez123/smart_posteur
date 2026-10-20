import { apiGetRaw } from './client';
import { endpoints } from './endpoints';
import type { HealthResponse } from './types';

/**
 * `GET /health`
 *
 * A 200 response with `status: "degraded"` means the server is reachable but
 * MongoDB is unavailable — callers must not render that as fully healthy.
 */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGetRaw<HealthResponse>(endpoints.health, { signal });
}

/** True when the backend is reachable but the database is not usable. */
export function isDegradedHealth(health: HealthResponse | null): boolean {
  return health !== null && (health.status === 'degraded' || health.database !== 'connected');
}
