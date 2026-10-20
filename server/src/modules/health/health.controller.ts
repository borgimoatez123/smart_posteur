import type { RequestHandler } from 'express';
import { getDatabaseError, getDatabaseStatus, isDatabaseConnected } from '../../config/database';

/**
 * GET /health
 *
 * Reports the real database state. When MongoDB is unreachable the endpoint
 * still answers 200 with `status: "degraded"` so the ESP32 and Flutter can tell
 * the difference between "server down" and "server up but database unavailable".
 */
export const getHealth: RequestHandler = (_req, res) => {
  const database = getDatabaseStatus();
  const connected = isDatabaseConnected();

  res.status(200).json({
    status: connected ? 'ok' : 'degraded',
    database,
    timestamp: new Date().toISOString(),
    ...(connected ? {} : { databaseError: getDatabaseError() ?? 'MongoDB is not connected' }),
  });
};
