import { z } from 'zod';
import { eventSeveritySchema, eventTypeSchema } from '../../shared/domain';
import { paginationQuerySchema, sortOrderSchema } from '../../utils/pagination';
import { createFilteredListQuerySchema, deviceIdSchema, isoTimestampSchema } from '../../utils/validation';

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'must be a 24 character hexadecimal identifier');

export const createEventBodySchema = z.object({
  deviceId: deviceIdSchema,
  type: eventTypeSchema,
  severity: eventSeveritySchema.optional(),
  timestamp: isoTimestampSchema.optional(),
  sessionId: objectIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  /**
   * Optional explicit event identifier. When omitted the service derives one
   * from deviceId + type + timestamp so retries cannot duplicate the event.
   */
  dedupeKey: z.string().trim().min(3).max(200).optional(),
});

export type CreateEventBody = z.infer<typeof createEventBodySchema>;

export const listEventsQuerySchema = createFilteredListQuerySchema({
  ...paginationQuerySchema.shape,
  deviceId: deviceIdSchema.optional(),
  type: eventTypeSchema.optional(),
  severity: eventSeveritySchema.optional(),
  sessionId: objectIdSchema.optional(),
  sort: sortOrderSchema.default('desc'),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const eventIdParamSchema = z.object({ id: objectIdSchema });
