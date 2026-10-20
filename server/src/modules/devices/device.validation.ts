import { z } from 'zod';
import { deviceIdSchema, isoTimestampSchema } from '../../utils/validation';

export const deviceIdParamSchema = z.object({ deviceId: deviceIdSchema });

export const heartbeatBodySchema = z
  .object({
    battery: z.number().int().min(0).max(100).nullable().optional(),
    timestamp: isoTimestampSchema.optional(),
  })
  .optional()
  .default({});

export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
