import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import * as deviceService from './device.service';

export const getDevices: RequestHandler = asyncHandler(async (_req, res) => {
  const devices = await deviceService.listDevices();
  return sendSuccess(res, { devices, count: devices.length });
});

export const getDeviceById: RequestHandler = asyncHandler(async (req, res) => {
  const device = await deviceService.getDeviceOrThrow(req.params.deviceId);
  return sendSuccess(res, device);
});

export const getDeviceStatus: RequestHandler = asyncHandler(async (req, res) => {
  const status = await deviceService.getDeviceStatus(req.params.deviceId);
  return sendSuccess(res, status);
});

export const postHeartbeat: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as { battery?: number | null; timestamp?: Date };
  const result = await deviceService.recordHeartbeat(req.params.deviceId, {
    battery: body.battery ?? null,
    timestamp: body.timestamp,
  });
  return sendSuccess(res, result, 'Heartbeat recorded');
});
