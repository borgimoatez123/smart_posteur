import express, { type Express } from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { buildCorsOptions } from './config/cors';
import { env } from './config/env';
import { mountSwagger } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiRateLimiter } from './middleware/rate-limit.middleware';
import healthRoutes from './modules/health/health.routes';
import apiRoutes from './routes';
import { logger } from './utils/logger';

/**
 * Builds the Express application.
 *
 * The app is intentionally free of side effects (no database connection, no
 * listening socket) so tests can mount it against an isolated in-memory MongoDB.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // No reverse proxy in front of this LAN prototype, so `trust proxy` stays off:
  // clients such as the ESP32 and phones connect directly, and trusting
  // X-Forwarded-For would let them spoof their address to bypass rate limiting.

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  app.use(cors(buildCorsOptions()));

  // Request size limit protects the (unauthenticated) prototype from abuse.
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));

  app.use(apiRateLimiter);

  mountSwagger(app);

  app.use('/health', healthRoutes);
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
