import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import { AppError } from '../../utils/http-error';
import * as historyService from './history.service';
import type { ListHistoryQuery } from './history.validation';

export const getHistory: RequestHandler = asyncHandler(async (req, res) => {
  const result = await historyService.listHistory(req.query as unknown as ListHistoryQuery);
  return sendSuccess(res, result);
});

export const getHistoryById: RequestHandler = asyncHandler(async (req, res) => {
  const record = await historyService.getHistoryById(req.params.id);
  if (!record) {
    throw AppError.notFound(`Telemetry record ${req.params.id} was not found`, undefined, 'TELEMETRY_NOT_FOUND');
  }
  return sendSuccess(res, record);
});
