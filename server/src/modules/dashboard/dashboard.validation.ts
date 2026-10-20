import { z } from 'zod';
import { deviceIdSchema } from '../../utils/validation';
import { DASHBOARD_PERIODS } from './dashboard.service';

export const dashboardQuerySchema = z.object({
  deviceId: deviceIdSchema.optional(),
});

export const dashboardSummaryQuerySchema = z.object({
  deviceId: deviceIdSchema.optional(),
  period: z.enum(DASHBOARD_PERIODS).default('day'),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
