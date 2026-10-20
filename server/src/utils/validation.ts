import { z } from 'zod';

/** Device identifiers are opaque strings; no ownership semantics are implied. */
export const deviceIdSchema = z
  .string()
  .trim()
  .min(3, 'deviceId must be at least 3 characters long')
  .max(64, 'deviceId must be at most 64 characters long')
  .regex(/^[A-Za-z0-9._:-]+$/, 'deviceId may only contain letters, digits, ".", "_", ":" and "-"');

/**
 * Device supplied timestamp. ISO-8601 is required (an explicit UTC offset is
 * accepted) and parsed into a real Date.
 */
export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true, message: 'timestamp must be an ISO-8601 date/time string' })
  .transform((value) => new Date(value));

/** Lenient date parser for query parameters (`from`/`to`). */
export const dateLikeSchema = z
  .string()
  .min(1, 'Date value is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid date/time value' })
  .transform((value) => new Date(value));

/**
 * Builds a list-query schema from a module specific shape, always adding
 * `from`/`to` filters plus the cross-field chronology check.
 */
export function createFilteredListQuerySchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...shape, from: dateLikeSchema.optional(), to: dateLikeSchema.optional() })
    .refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), {
      message: '`from` must be earlier than or equal to `to`',
      path: ['from'],
    });
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
