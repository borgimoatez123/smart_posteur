/**
 * Centralised runtime configuration for the SmartPosture mobile app.
 *
 * The backend address is NEVER hardcoded inside a screen: every request goes
 * through `src/api/client.ts`, which reads the values below.
 *
 * Override at run/build time with Expo public environment variables:
 *   EXPO_PUBLIC_API_URL=http://10.125.202.96:3000
 *   EXPO_PUBLIC_DEVICE_ID=posture-belt-01
 *
 * Android emulator: the host machine is reachable at `10.0.2.2`, not
 * `127.0.0.1`, so run with EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 there.
 * Physical Android device: use the LAN IP of the computer running the backend.
 *
 * IMPORTANT: `process.env.EXPO_PUBLIC_*` must be accessed statically so the
 * Expo/Metro transform can inline it. Do not alias `process.env`.
 */

/** Physical-device default: LAN IP of the machine running the backend. */
export const DEFAULT_BACKEND_URL = "http://10.68.235.96:3000";

/** Host address that the Android emulator uses to reach the host machine. */
export const EMULATOR_BACKEND_URL = "http://10.0.2.2:3000";

/** Fixed wearable identifier. The ESP32 uses the same value. */
export const DEFAULT_DEVICE_ID = "posture-belt-01";

/** Every versioned REST resource lives under this prefix. */
export const API_PREFIX = "/api/v1";

export const REQUEST_TIMEOUT_MS = 10_000;

/** Live posture / device status polling (brief: 3–5 s). */
export const LIVE_POLL_INTERVAL_MS = 4_000;
/** Aggregated analytics change slowly; poll less often. */
export const SUMMARY_POLL_INTERVAL_MS = 30_000;
/**
 * Live AI advice is generated from a rolling window, so polling faster than
 * this would only re-read the same telemetry (the backend also rate limits and
 * caches this endpoint).
 */
export const LIVE_AI_POLL_INTERVAL_MS = 45_000;
/** Rolling window (minutes) requested from the live AI endpoint. */
export const LIVE_AI_WINDOW_MINUTES = 10;
export const HEALTH_POLL_INTERVAL_MS = 15_000;
export const STATUS_POLL_INTERVAL_MS = 10_000;

/** Default page size for the paginated lists (history, sessions, events). */
export const LIST_PAGE_SIZE = 20;

function readEnv(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Base origin, e.g. `http://10.125.202.96:3000` (no trailing slash). */
export const API_BASE_URL = trimTrailingSlash(
  readEnv(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_BACKEND_URL,
);

/** Fixed device id used by every device-scoped request. */
export const DEVICE_ID =
  readEnv(process.env.EXPO_PUBLIC_DEVICE_ID) ?? DEFAULT_DEVICE_ID;

/** Whether the operator overrode the default backend address. */
export const USES_CUSTOM_BACKEND_URL =
  readEnv(process.env.EXPO_PUBLIC_API_URL) !== null;
