import { z } from 'zod';
import { postureLabelSchema } from '../../shared/domain';
import { paginationQuerySchema, sortOrderSchema } from '../../utils/pagination';
import { createFilteredListQuerySchema, deviceIdSchema } from '../../utils/validation';
import { objectIdSchema } from '../events/event.validation';

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const listHistoryQuerySchema = createFilteredListQuerySchema({
  ...paginationQuerySchema.shape,
  deviceId: deviceIdSchema.optional(),
  posture: postureLabelSchema.optional(),
  alert: booleanQuery.optional(),
  sessionId: objectIdSchema.optional(),
  sort: sortOrderSchema.default('desc'),
});

export type ListHistoryQuery = z.infer<typeof listHistoryQuerySchema>;

export const historyIdParamSchema = z.object({ id: objectIdSchema });
