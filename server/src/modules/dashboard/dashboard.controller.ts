import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import * as dashboardService from './dashboard.service';
import type { DashboardSummaryQuery } from './dashboard.validation';

export const getDashboard: RequestHandler = asyncHandler(async (req, res) => {
  const deviceId = (req.query as { deviceId?: string }).deviceId ?? null;
  const dashboard = await dashboardService.getDashboard(deviceId);
  return sendSuccess(res, dashboard);
});

export const getCurrent: RequestHandler = asyncHandler(async (req, res) => {
  const deviceId = (req.query as { deviceId?: string }).deviceId ?? null;
  const current = await dashboardService.getCurrent(deviceId);
  return sendSuccess(res, current, current.available ? 'OK' : current.message ?? 'No data');
});

export const getSummary: RequestHandler = asyncHandler(async (req, res) => {
  const { deviceId, period } = req.query as unknown as DashboardSummaryQuery;
  const summary = await dashboardService.getSummary(period, deviceId ?? null);
  return sendSuccess(res, summary, summary.hasData ? 'OK' : summary.message ?? 'No data');
});
