import pino from 'pino';
import { env } from '../config/env';

/**
 * Structured logger. In test mode logging is silenced so the test output stays
 * readable; production/development use the configured level.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: 'smartposture-server', env: env.NODE_ENV },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
