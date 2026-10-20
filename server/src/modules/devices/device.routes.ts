import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as deviceController from './device.controller';
import { deviceIdParamSchema, heartbeatBodySchema } from './device.validation';

const router = Router();

router.get('/', deviceController.getDevices);

router.get(
  '/:deviceId',
  validate({ params: deviceIdParamSchema }),
  deviceController.getDeviceById,
);

router.get(
  '/:deviceId/status',
  validate({ params: deviceIdParamSchema }),
  deviceController.getDeviceStatus,
);

router.post(
  '/:deviceId/heartbeat',
  validate({ params: deviceIdParamSchema, body: heartbeatBodySchema }),
  deviceController.postHeartbeat,
);

export default router;
