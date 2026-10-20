import type { MeasurementUnit } from '../types/settings';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** Convert a nullable angle to degrees (from radians if needed). */
export function toDegrees(value: number | null, unit: MeasurementUnit): number | null {
  if (value === null || value === undefined) return null;
  return unit === 'radians' ? value * RAD_TO_DEG : value;
}

/** Convert a nullable angle to radians. */
export function toRadians(value: number | null, unit: MeasurementUnit): number | null {
  if (value === null || value === undefined) return null;
  return unit === 'radians' ? value : value * DEG_TO_RAD;
}

/** Format an angle for display, returning "—" when unavailable. */
export function formatAngle(value: number | null, unit: MeasurementUnit = 'degrees'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const deg = toDegrees(value, unit);
  if (deg === null) return '—';
  return `${deg.toFixed(1)}°`;
}

/** Format a duration in milliseconds as mm:ss. */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format a battery percentage, returning "—" when unavailable. */
export function formatBattery(battery: number | null): string {
  if (battery === null || battery === undefined) return '—';
  return `${Math.round(battery)}%`;
}

/** Format a timestamp as HH:MM:SS. */
export function formatTime(ts: number | null): string {
  if (ts === null || ts === undefined) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
