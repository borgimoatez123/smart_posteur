import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as sessionController from './session.controller';
import {
  createSessionBodySchema,
  endSessionBodySchema,
  listSessionsQuerySchema,
  sessionIdParamSchema,
} from './session.validation';

const router = Router();

router.get('/', validate({ query: listSessionsQuerySchema }), sessionController.getSessions);
router.post('/', validate({ body: createSessionBodySchema }), sessionController.postSession);
router.get('/:id', validate({ params: sessionIdParamSchema }), sessionController.getSessionById);
router.patch(
  '/:id/end',
  validate({ params: sessionIdParamSchema, body: endSessionBodySchema }),
  sessionController.patchSessionEnd,
);

export default router;
