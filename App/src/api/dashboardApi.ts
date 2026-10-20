import { DEVICE_ID } from '../config/appConfig';
import { apiRequest } from './client';
import { endpoints } from './endpoints';
import type { CurrentPosture, DashboardPeriod, DashboardSummary, DashboardView } from './types';

/** `GET /api/v1/dashboard/current?deviceId=...` */
export function getCurrentPosture(
  deviceId: string = DEVICE_ID,
  signal?: AbortSignal,
): Promise<CurrentPosture> {
  return apiRequest<CurrentPosture>(endpoints.dashboardCurrent, { query: { deviceId }, signal });
}

/** `GET /api/v1/dashboard/summary?period=day|week|month&deviceId=...` */
export function getSummary(
  period: DashboardPeriod,
  deviceId: string = DEVICE_ID,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>(endpoints.dashboardSummary, {
    query: { period, deviceId },
    signal,
  });
}

/**
 * `GET /api/v1/dashboard?deviceId=...`
 *
 * Single round trip returning both the current posture and the day summary.
 */
export function getDashboard(
  deviceId: string = DEVICE_ID,
  signal?: AbortSignal,
): Promise<DashboardView> {
  return apiRequest<DashboardView>(endpoints.dashboard, { query: { deviceId }, signal });
}
