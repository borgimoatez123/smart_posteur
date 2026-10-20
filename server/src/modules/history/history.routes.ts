import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as historyController from './history.controller';
import { historyIdParamSchema, listHistoryQuerySchema } from './history.validation';

const router = Router();

router.get('/', validate({ query: listHistoryQuerySchema }), historyController.getHistory);
router.get('/:id', validate({ params: historyIdParamSchema }), historyController.getHistoryById);

export default router;
