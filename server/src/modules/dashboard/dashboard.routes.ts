import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as dashboardController from './dashboard.controller';
import { dashboardQuerySchema, dashboardSummaryQuerySchema } from './dashboard.validation';

const router = Router();

router.get('/', validate({ query: dashboardQuerySchema }), dashboardController.getDashboard);
router.get('/current', validate({ query: dashboardQuerySchema }), dashboardController.getCurrent);
router.get('/summary', validate({ query: dashboardSummaryQuerySchema }), dashboardController.getSummary);

export default router;
