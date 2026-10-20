/**
 * Wire types for the SmartPosture backend REST API.
 *
 * These mirror the actual server views (`Server/src/modules/**`) 1:1. Optional
 * fields are modelled as nullable where the server may return `null`, and are
 * never given fabricated fallback values downstream.
 */
import type { PostureClass } from '../types/posture';

/** Posture vocabulary shared with the ESP32 and the backend. */
export type PostureLabel = PostureClass;
export type DashboardPeriod = 'day' | 'week' | 'month';
export type SortOrder = 'asc' | 'desc';

export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type DatabaseStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'disconnecting'
  | 'unknown';

export type EventType =
  | 'POSTURE_INCORRECT'
  | 'VIBRATION_ALERT'
  | 'DEVICE_DISCONNECTED'
  | 'DEVICE_RECONNECTED'
  | 'LOW_BATTERY'
  | 'SENSOR_ERROR';

export type EventSeverity = 'info' | 'warning' | 'critical';
export type RecommendationStatus = 'success' | 'error' | 'unavailable';
export type RecommendationPriority = 'low' | 'medium' | 'high';

/* ------------------------------------------------------------------ */
/* Envelope + pagination                                               */
/* ------------------------------------------------------------------ */

export interface ApiErrorBody {
  code?: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiErrorBody | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/* ------------------------------------------------------------------ */
/* Health (GET /health — NOT wrapped in the envelope)                  */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: DatabaseStatus;
  timestamp: string;
  databaseError?: string;
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

export interface DeviceView {
  deviceId: string;
  name: string | null;
  status: DeviceStatus;
  lastSeen: string | null;
  secondsSinceLastSeen: number | null;
  batteryLevel: number | null;
  latestPosture: PostureLabel | null;
  latestAngle: number | null;
  latestConfidence: number | null;
  latestAlert: boolean;
  latestTelemetryAt: string | null;
}

export interface DeviceStatusView extends DeviceView {
  offlineTimeoutSeconds: number;
  heartbeatIntervalSeconds: number;
}

export interface DeviceListResponse {
  devices: DeviceView[];
  count: number;
}

/* ------------------------------------------------------------------ */
/* Dashboard / current posture                                         */
/* ------------------------------------------------------------------ */

export interface CurrentPosture {
  available: boolean;
  deviceId: string | null;
  posture: PostureLabel | null;
  angle: number | null;
  confidence: number | null;
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  timestamp: string | null;
  deviceStatus: DeviceStatus;
  lastSeen: string | null;
  message?: string;
}

export interface DashboardTotals {
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  averageAngle: number | null;
}

export interface PostureDistributionEntry {
  label: PostureLabel;
  count: number;
  percentage: number;
}

export interface TrendBucket {
  label: string;
  start: string;
  end: string;
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  goodPosturePercentage: number;
}

export interface DashboardSummary {
  period: DashboardPeriod;
  deviceId: string | null;
  range: { from: string; to: string };
  totals: DashboardTotals;
  postureDistribution: PostureDistributionEntry[];
  trends: TrendBucket[];
  hasData: boolean;
  message?: string;
}

export interface DashboardView {
  generatedAt: string;
  current: CurrentPosture;
  summary: DashboardSummary;
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export interface HistorySensors {
  ax: number | null;
  ay: number | null;
  az: number | null;
  gx: number | null;
  gy: number | null;
  gz: number | null;
}

export interface HistoryPosture {
  label: PostureLabel;
  angle: number;
  confidence: number | null;
  badDurationSeconds: number | null;
}

export interface HistoryRecord {
  id: string;
  deviceId: string;
  timestamp: string;
  receivedAt: string | null;
  sensors: HistorySensors | null;
  posture: HistoryPosture;
  alert: boolean;
  battery: number | null;
  sensorError: boolean;
  sessionId: string | null;
  samplingHz: number | null;
}

export interface HistoryQuery {
  page?: number;
  limit?: number;
  deviceId?: string;
  posture?: PostureLabel;
  alert?: boolean;
  sessionId?: string;
  from?: string;
  to?: string;
  sort?: SortOrder;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export interface PostureStats {
  measurements: number;
  incorrectPostureEvents: number;
  goodDurationSeconds: number;
  badDurationSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  averageAngle: number | null;
  firstSampleAt: string | null;
  lastSampleAt: string | null;
}

export interface SessionView {
  id: string;
  deviceId: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  statistics: PostureStats;
  statisticsAreFinal: boolean;
  notes: string | null;
  createdAt: string | null;
}

export interface SessionQuery {
  page?: number;
  limit?: number;
  deviceId?: string;
  status?: 'active' | 'ended';
  from?: string;
  to?: string;
  sort?: SortOrder;
}

export interface CreateSessionBody {
  deviceId: string;
  startedAt?: string;
  notes?: string | null;
}

export interface EndSessionBody {
  endedAt?: string;
  notes?: string | null;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export interface EventView {
  id: string;
  deviceId: string;
  sessionId: string | null;
  type: EventType;
  severity: EventSeverity;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface EventQuery {
  page?: number;
  limit?: number;
  deviceId?: string;
  type?: EventType;
  severity?: EventSeverity;
  sessionId?: string;
  from?: string;
  to?: string;
  sort?: SortOrder;
}

/* ------------------------------------------------------------------ */
/* AI recommendations                                                  */
/* ------------------------------------------------------------------ */

export interface RecommendationItem {
  title: string;
  detail: string;
  priority: RecommendationPriority;
}

export interface RecommendationView {
  id: string;
  period: DashboardPeriod;
  deviceId: string | null;
  generatedAt: string;
  summary: string | null;
  recommendations: RecommendationItem[];
  model: string;
  status: RecommendationStatus;
  error: string | null;
  cached: boolean;
  aiConfigured: boolean;
  disclaimer: string;
}

export interface GenerateRecommendationBody {
  period: DashboardPeriod;
  deviceId?: string;
  refresh?: boolean;
}

/* ------------------------------------------------ */
/* Live AI recommendations (GET /ai/recommendations/live) */
/* ------------------------------------------------ */

/** How much real telemetry backs the live snapshot. */
export type LiveDataQuality = 'none' | 'limited' | 'recent' | 'established';

/** Where the live wording came from: Gemini, the backend template, or nothing. */
export type LiveRecommendationSource = 'gemini' | 'fallback' | 'none';

/** Short coaching block returned by the backend. */
export interface CoachingAdvice {
  title: string;
  immediateAction: string;
  futureImpact: string;
  priority: RecommendationPriority;
  /** One telemetry-grounded sentence explaining why this advice was chosen. */
  reason: string;
}

export interface LiveCurrentPosture {
  posture: PostureLabel;
  angle: number | null;
  confidence: number | null;
  alert: boolean;
  timestamp: string | null;
}

export interface LivePostureDistributionEntry {
  label: PostureLabel;
  count: number;
  percentage: number;
}

/**
 * `GET /api/v1/ai/recommendations/live?deviceId=...&windowMinutes=...`
 *
 * Always HTTP 200: `available: false` / `dataQuality: 'none'` / `source: 'none'`
 * describe "no telemetry in the window", and `stale: true` describes telemetry
 * that is too old to be presented as the current position. None of these are
 * errors, and none of them may be replaced by client-side invented data.
 */
export interface LiveRecommendationView {
  deviceId: string | null;
  available: boolean;
  stale: boolean;
  dataQuality: LiveDataQuality;
  windowMinutes: number;
  sampleCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  latestSampleAgeSeconds: number | null;
  current: LiveCurrentPosture | null;
  dominantPosture: PostureLabel | null;
  postureDistribution: LivePostureDistributionEntry[];
  averageAngle: number | null;
  angleDelta: number | null;
  postureChanges: number;
  incorrectPostureEvents: number;
  persistentIncorrectSeconds: number;
  monitoredDurationSeconds: number;
  goodPosturePercentage: number;
  summary: string | null;
  advice: CoachingAdvice | null;
  source: LiveRecommendationSource;
  model: string | null;
  cached: boolean;
  generatedAt: string;
  aiConfigured: boolean;
  disclaimer: string;
  message: string;
}
