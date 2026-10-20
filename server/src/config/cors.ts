import type { CorsOptions } from 'cors';
import { corsOrigins, isDevelopment } from './env';
import { AppError } from '../utils/http-error';

/**
 * CORS configuration.
 *
 * NOTE: CORS only tells browsers which origins may read responses. It does not
 * authenticate a client, and it does not protect the API from a device that
 * simply issues HTTP requests (the ESP32 does not even send an Origin header).
 */
export function buildCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      // Native clients (ESP32, Dio on Android) send no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins === '*') {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(AppError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: isDevelopment ? 204 : 200,
  };
}
