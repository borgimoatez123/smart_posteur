import { getCurrentPosture, getDashboard, getSummary } from '../api/dashboardApi';
import type { CurrentPosture, DashboardPeriod, DashboardSummary, DashboardView } from '../api/types';
import { DEVICE_ID, LIVE_POLL_INTERVAL_MS, SUMMARY_POLL_INTERVAL_MS } from '../config/appConfig';
import { useResource, type ResourceState } from './useResource';

/**
 * Latest stored posture, polled at the live interval (4 s).
 * Values come exclusively from real telemetry; `available: false` means the
 * backend has no measurements yet.
 */
export function useCurrentPosture(enabled = true): ResourceState<CurrentPosture> {
  return useResource<CurrentPosture>((signal) => getCurrentPosture(DEVICE_ID, signal), {
    enabled,
    pollMs: LIVE_POLL_INTERVAL_MS,
  });
}

/**
 * `GET /dashboard` — current posture + day summary in one round trip.
 * Used by the dashboard for its default period and manual refresh.
 */
export function useDashboardSnapshot(enabled = true): ResourceState<DashboardView> {
  return useResource<DashboardView>((signal) => getDashboard(DEVICE_ID, signal), {
    enabled,
    pollMs: SUMMARY_POLL_INTERVAL_MS,
  });
}

/** `GET /dashboard/summary` for a specific period (week / month). */
export function useDashboardSummary(
  period: DashboardPeriod,
  enabled = true,
): ResourceState<DashboardSummary> {
  return useResource<DashboardSummary>((signal) => getSummary(period, DEVICE_ID, signal), {
    enabled,
    pollMs: SUMMARY_POLL_INTERVAL_MS,
    deps: [period],
  });
}
