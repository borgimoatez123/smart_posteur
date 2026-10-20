import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as eventController from './event.controller';
import {
  createEventBodySchema,
  eventIdParamSchema,
  listEventsQuerySchema,
} from './event.validation';

const router = Router();

router.get('/', validate({ query: listEventsQuerySchema }), eventController.getEvents);
router.post('/', validate({ body: createEventBodySchema }), eventController.postEvent);
router.get('/:id', validate({ params: eventIdParamSchema }), eventController.getEventById);

export default router;
