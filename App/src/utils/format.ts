/**
 * Formatting helpers for API values.
 *
 * Every formatter returns an explicit placeholder ("—") for missing values so
 * "no data" can never be confused with a real zero.
 */

const MISSING = '—';

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Human readable duration derived from a real duration in seconds.
 * Durations come from the backend (timestamp deltas), never from sample counts.
 */
export function formatDurationHuman(seconds: number | null | undefined): string {
  if (!isUsableNumber(seconds) || seconds < 0) return MISSING;
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

  const secs = total % 60;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

/** Duration in `mm:ss` / `h:mm:ss` — used for session timers. */
export function formatDurationClock(seconds: number | null | undefined): string {
  if (!isUsableNumber(seconds) || seconds < 0) return MISSING;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Full local date + time, e.g. `17/10/2026, 14:32:05`. */
export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return MISSING;
  return date.toLocaleString();
}

/** Local date only, e.g. `17/10/2026`. */
export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return MISSING;
  return date.toLocaleDateString();
}

/** Local time only, e.g. `14:32:05`. */
export function formatTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return MISSING;
  return date.toLocaleTimeString();
}

/** `3 min ago` style label, or the absolute timestamp when older than a day. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  const date = toDate(iso);
  if (!date) return MISSING;
  const deltaSeconds = Math.round((now - date.getTime()) / 1000);
  if (deltaSeconds < 0) return formatDateTime(iso);
  if (deltaSeconds < 10) return 'just now';
  if (deltaSeconds < 60) return `${deltaSeconds} s ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(iso);
}

/** Uses the server-computed `secondsSinceLastSeen`. */
export function formatSecondsAgo(seconds: number | null | undefined): string {
  if (!isUsableNumber(seconds) || seconds < 0) return MISSING;
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** Percentage with an explicit unit; missing values render as "—". */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (!isUsableNumber(value)) return MISSING;
  return `${value.toFixed(digits)}%`;
}

/** Angle in degrees. */
export function formatDegrees(value: number | null | undefined, digits = 1): string {
  if (!isUsableNumber(value)) return MISSING;
  return `${value.toFixed(digits)}°`;
}

/** Plain number with a fixed precision. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (!isUsableNumber(value)) return MISSING;
  return value.toFixed(digits);
}

/** Battery percentage. */
export function formatBatteryLevel(value: number | null | undefined): string {
  if (!isUsableNumber(value)) return MISSING;
  return `${Math.round(value)}%`;
}

/** Compact label for a time window, e.g. `17/10/2026 09:00`. */
export function formatRange(from: string | null | undefined, to: string | null | undefined): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return MISSING;
  const day = start.toLocaleDateString();
  const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${startTime} – ${endTime}`;
}
