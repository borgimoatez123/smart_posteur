import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration.
 *
 * The schema is parsed exactly once at import time. An invalid configuration
 * logs every offending variable and throws, so the process never starts with a
 * half-applied configuration.
 */

const booleanish = z.preprocess((value) => {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return value;
}, z.boolean());

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().min(1).default('info'),

  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/smartposture'),

  CORS_ORIGINS: z.string().default('*'),

  DEVICE_OFFLINE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  DEVICE_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15),

  TELEMETRY_SAMPLING_HZ: z.coerce.number().positive().max(200).default(10),
  SESSION_MAX_GAP_SECONDS: z.coerce.number().positive().default(5),
  TELEMETRY_RETENTION_DAYS: z.coerce.number().int().min(0).default(30),

  LOW_BATTERY_THRESHOLD: z.coerce.number().min(0).max(100).default(20),

  REQUEST_BODY_LIMIT: z.string().min(1).default('256kb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  SWAGGER_ENABLED: booleanish.default(true),

  GEMINI_API_KEY: optionalSecret,
  // A low-latency tier: the reasoning tiers (e.g. gemini-3.8-flash) can take
  // well over a minute on the same prompt, which is unusable for a REST call.
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  /**
   * How long a stored day/week/month recommendation is still considered a
   * usable cache hit. Older than this, the same statistics trigger a fresh
   * Gemini call instead of being served from the cache.
   */
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  /**
   * How long a stored recommendation is kept at all. This is deliberately much
   * longer than the cache window: the cache decides *when to regenerate*, while
   * retention decides *when to forget*. Without a long retention the `/latest`
   * endpoint 404s a few minutes after a recommendation was generated.
   */
  AI_RECOMMENDATION_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

  /** Rolling window (in minutes) analysed by the live recommendation endpoint. */
  AI_LIVE_WINDOW_MINUTES: z.coerce.number().int().min(1).max(120).default(10),
  /** Hard cap on the window samples loaded from MongoDB. */
  AI_LIVE_MAX_SAMPLES: z.coerce.number().int().positive().default(300),
  /**
   * A live answer is "stale" when the newest sample is older than this. Stale
   * telemetry is never presented as if the device were streaming right now.
   */
  AI_LIVE_STALE_SECONDS: z.coerce.number().int().positive().default(120),
  /**
   * How long a live coaching answer may be reused. The cache key is derived from
   * the coaching context (posture, urgency, density), which is exactly what
   * decides whether the advice should change, so a longer window keeps the text
   * stable instead of regenerating it on every poll. Material context changes
   * still invalidate the entry immediately, and the numbers reported alongside
   * the advice are always recomputed from the latest telemetry.
   */
  AI_LIVE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    const message = `Invalid environment configuration:\n${details}`;
    console.error(`[config] ${message}`);
    throw new Error(message);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * `*` means "reflect any origin" (local development only). Otherwise an
 * explicit allowlist is used. CORS is NOT an authentication mechanism.
 */
export const corsOrigins: string[] | '*' =
  env.CORS_ORIGINS.trim() === '' || env.CORS_ORIGINS.trim() === '*'
    ? '*'
    : env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

export const deviceOfflineTimeoutMs = env.DEVICE_OFFLINE_TIMEOUT_SECONDS * 1000;
