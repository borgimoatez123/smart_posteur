import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import { ingestTelemetry } from './telemetry.service';
import { ingestTelemetryBodySchema, type IngestTelemetryInput } from './telemetry.validation';

const router = Router();

/**
 * POST /api/v1/telemetry
 *
 * Compact response for embedded devices. HTTP 201 when a record was stored,
 * HTTP 200 for an idempotent retry of an already stored occurrence.
 */
router.post(
  '/',
  validate({ body: ingestTelemetryBodySchema }),
  asyncHandler(async (req, res) => {
    const outcome = await ingestTelemetry(req.body as IngestTelemetryInput);
    const { recordId, duplicate, sessionId, eventsCreated } = outcome.result;

    return sendSuccess(
      res,
      {
        id: recordId,
        duplicate,
        sessionId,
        events: eventsCreated,
      },
      duplicate ? 'Duplicate telemetry ignored' : 'Telemetry stored',
      outcome.statusCode,
    );
  }),
);

export default router;
