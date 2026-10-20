/**
 * Vitest bootstrap. Runs before every test file is imported, so the
 * configuration is already in place when `config/env.ts` parses process.env.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
// Keep the TTL index out of the test database: retention is a runtime concern.
process.env.TELEMETRY_RETENTION_DAYS = '0';
// Ensure the AI tests exercise the "not configured" path by default.
// Assigned (not deleted) on purpose: `dotenv` never overrides variables that
// are already present in process.env, so a real key in `.env` cannot leak here.
// `optionalSecret` in config/env.ts then maps the empty string to `undefined`.
process.env.GEMINI_API_KEY = '';
