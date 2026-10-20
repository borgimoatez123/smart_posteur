import { Router } from 'express';
import { aiRateLimiter } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as aiController from './ai.controller';
import {
  createRecommendationBodySchema,
  latestRecommendationQuerySchema,
  liveRecommendationQuerySchema,
} from './ai.validation';

const router = Router();

router.post(
  '/recommendations',
  aiRateLimiter,
  validate({ body: createRecommendationBodySchema }),
  aiController.postRecommendations,
);

// Registered before `/recommendations/latest` for readability only: both are
// static paths, so there is no route-shadowing risk.
router.get(
  '/recommendations/live',
  aiRateLimiter,
  validate({ query: liveRecommendationQuerySchema }),
  aiController.getLiveRecommendation,
);

router.get(
  '/recommendations/latest',
  validate({ query: latestRecommendationQuerySchema }),
  aiController.getLatestRecommendation,
);

export default router;
