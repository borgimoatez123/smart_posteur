/**
 * Centralised HTTP client for the SmartPosture backend.
 *
 * Responsibilities:
 *  - single configurable base URL (see `src/config/appConfig.ts`)
 *  - request timeouts + caller driven cancellation
 *  - safe parsing of the `{ success, message, data, error }` envelope
 *  - backend error codes mapped to readable, non-leaking messages
 *
 * Every network failure surfaces as an `ApiError`. Failures are NEVER replaced
 * by fabricated fallback data.
 */
import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS } from '../config/appConfig';
import type { ApiEnvelope } from './types';

/**
 * Known error codes. Backend supplied codes are passed through unchanged, so
 * the type stays open-ended on purpose.
 */
export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'MALFORMED_RESPONSE'
  | 'HTTP_ERROR'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_VALIDATION_ERROR'
  | 'INVALID_IDENTIFIER'
  | 'DUPLICATE_RECORD'
  | 'PAYLOAD_TOO_LARGE'
  | 'MALFORMED_JSON'
  | 'INTERNAL_ERROR'
  | 'ROUTE_NOT_FOUND'
  | 'DEVICE_NOT_FOUND'
  | 'TELEMETRY_NOT_FOUND'
  | 'EVENT_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'RECOMMENDATION_NOT_FOUND'
  | 'NO_POSTURE_DATA'
  | 'GEMINI_NOT_CONFIGURED'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export interface ApiErrorInit {
  code: ApiErrorCode;
  message: string;
  status?: number | null;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details ?? null;
  }

  /** True when the phone could not reach the backend at all. */
  get isConnectivityError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

/** Normalises anything thrown by a fetcher into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError({
    code: 'NETWORK_ERROR',
    message: `Unexpected client error while contacting ${API_BASE_URL}: ${message}`,
  });
}

const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'The server rejected the request parameters. Please review the filters and try again.',
  DATABASE_VALIDATION_ERROR: 'The server rejected the submitted values.',
  INVALID_IDENTIFIER: 'That identifier is not valid.',
  DUPLICATE_RECORD: 'That record already exists on the server.',
  PAYLOAD_TOO_LARGE: 'The request was too large for the server.',
  MALFORMED_JSON: 'The request body could not be parsed by the server.',
  DATABASE_UNAVAILABLE:
    'The backend is reachable but MongoDB is unavailable, so stored data cannot be read right now.',
  INTERNAL_ERROR: 'The backend reported an internal error.',
  ROUTE_NOT_FOUND: 'That endpoint is not available on the configured backend.',
  DEVICE_NOT_FOUND: 'The wearable has never contacted the backend, so no device record exists yet.',
  TELEMETRY_NOT_FOUND: 'That history record was not found on the server.',
  EVENT_NOT_FOUND: 'That event was not found on the server.',
  SESSION_NOT_FOUND: 'That session was not found on the server.',
  RECOMMENDATION_NOT_FOUND: 'No stored recommendation exists yet for this period.',
  NO_POSTURE_DATA:
    'The backend has no posture measurements for this period yet, so no recommendation can be generated.',
  GEMINI_NOT_CONFIGURED:
    'AI recommendations are not configured on the backend (missing Gemini API key).',
  RATE_LIMITED: 'Too many requests were sent. Please wait a moment and try again.',
};

function messageForCode(code: ApiErrorCode, fallback?: string): string {
  const known = CODE_MESSAGES[code];
  if (known) return known;
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return `The backend returned ${code}.`;
}

function connectivityMessage(code: 'NETWORK_ERROR' | 'TIMEOUT'): string {
  if (code === 'TIMEOUT') {
    return `The backend at ${API_BASE_URL} did not respond within ${Math.round(
      REQUEST_TIMEOUT_MS / 1000,
    )} s. Check that the server is running and that the phone is on the same Wi-Fi network.`;
  }
  return `Cannot reach the backend at ${API_BASE_URL}. Check that the server is running, that it listens on a LAN-accessible interface, and that the phone is on the same Wi-Fi network.`;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Joins the configured base URL with a versioned API path. */
export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  return `${API_BASE_URL}${API_PREFIX}${path}${buildQueryString(query)}`;
}

/** Joins the configured base URL with an absolute (non versioned) path. */
export function buildAbsoluteUrl(path: string, query?: Record<string, QueryValue>): string {
  return `${API_BASE_URL}${path}${buildQueryString(query)}`;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'ROUTE_NOT_FOUND';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'HTTP_ERROR';
}

/**
 * Performs a request against the versioned API (`/api/v1`) and unwraps
 * `data` from the response envelope.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = timedOut || signal?.aborted === true || controller.signal.aborted;
    if (aborted && !timedOut) {
      throw new ApiError({ code: 'CANCELLED', message: 'Request cancelled.' });
    }
    throw new ApiError({
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: connectivityMessage(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR'),
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (parsed === null) {
    if (!response.ok) {
      throw new ApiError({
        code: statusToCode(response.status),
        message: `The backend returned HTTP ${response.status}.`,
        status: response.status,
      });
    }
    throw new ApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The backend returned a response that is not valid JSON.',
      status: response.status,
    });
  }

  if (!isEnvelope(parsed)) {
    if (!response.ok) {
      throw new ApiError({
        code: statusToCode(response.status),
        message: `The backend returned HTTP ${response.status}.`,
        status: response.status,
      });
    }
    throw new ApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The backend response did not match the expected { success, data } envelope.',
      status: response.status,
    });
  }

  const envelope = parsed as ApiEnvelope<T>;

  if (!response.ok || envelope.success !== true) {
    const code = envelope.error?.code ?? (response.status === 429 ? 'RATE_LIMITED' : statusToCode(response.status));
    const serverMessage = typeof envelope.message === 'string' ? envelope.message : undefined;
    throw new ApiError({
      code,
      message: messageForCode(code, serverMessage),
      status: response.status,
      details: envelope.error?.details,
    });
  }

  if (envelope.data === undefined) {
    throw new ApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The backend reported success but returned no data payload.',
      status: response.status,
    });
  }

  return envelope.data;
}

/**
 * Performs a request against a non-versioned endpoint (`GET /health`) whose
 * body is not wrapped in the API envelope.
 */
export async function apiGetRaw<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  let response: Response;
  try {
    response = await fetch(buildAbsoluteUrl(path), { method: 'GET', signal: controller.signal });
  } catch (error) {
    const aborted = timedOut || signal?.aborted === true || controller.signal.aborted;
    if (aborted && !timedOut) {
      throw new ApiError({ code: 'CANCELLED', message: 'Request cancelled.' });
    }
    throw new ApiError({
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: connectivityMessage(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR'),
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const text = await response.text();
  if (text.length === 0) {
    throw new ApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The backend returned an empty response body.',
      status: response.status,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError({
      code: 'MALFORMED_RESPONSE',
      message: 'The backend returned a health response that is not valid JSON.',
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new ApiError({
      code: statusToCode(response.status),
      message: `The backend returned HTTP ${response.status}.`,
      status: response.status,
      details: parsed,
    });
  }

  return parsed as T;
}
