/**
 * Single source of truth for backend paths.
 * Paths are relative to `API_PREFIX` unless documented otherwise.
 */
export const endpoints = {
  /** Absolute path (outside `/api/v1`). */
  health: '/health',

  devices: '/devices',
  device: (deviceId: string) => `/devices/${encodeURIComponent(deviceId)}`,
  deviceStatus: (deviceId: string) => `/devices/${encodeURIComponent(deviceId)}/status`,
  /**
   * Available for completeness only. The ESP32 owns the heartbeat; the mobile
   * app must never post heartbeats (see the data accuracy rules).
   */
  deviceHeartbeat: (deviceId: string) => `/devices/${encodeURIComponent(deviceId)}/heartbeat`,

  dashboard: '/dashboard',
  dashboardCurrent: '/dashboard/current',
  dashboardSummary: '/dashboard/summary',

  history: '/history',
  historyRecord: (id: string) => `/history/${encodeURIComponent(id)}`,

  sessions: '/sessions',
  session: (id: string) => `/sessions/${encodeURIComponent(id)}`,
  sessionEnd: (id: string) => `/sessions/${encodeURIComponent(id)}/end`,

  events: '/events',
  event: (id: string) => `/events/${encodeURIComponent(id)}`,

  recommendations: '/ai/recommendations',
  latestRecommendation: '/ai/recommendations/latest',
  /** Live advice computed from a rolling window of real telemetry. */
  liveRecommendation: '/ai/recommendations/live',
} as const;
