import { z } from 'zod';
import { paginationQuerySchema, sortOrderSchema } from '../../utils/pagination';
import { createFilteredListQuerySchema, deviceIdSchema, isoTimestampSchema } from '../../utils/validation';
import { objectIdSchema } from '../events/event.validation';

export const createSessionBodySchema = z.object({
  deviceId: deviceIdSchema,
  startedAt: isoTimestampSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

export const endSessionBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    endedAt: isoTimestampSchema.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
);

export type EndSessionBody = z.infer<typeof endSessionBodySchema>;

export const listSessionsQuerySchema = createFilteredListQuerySchema({
  ...paginationQuerySchema.shape,
  deviceId: deviceIdSchema.optional(),
  status: z.enum(['active', 'ended']).optional(),
  sort: sortOrderSchema.default('desc'),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export const sessionIdParamSchema = z.object({ id: objectIdSchema });
