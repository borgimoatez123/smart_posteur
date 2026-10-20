import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { env, isTest } from '../config/env';
import { AppError } from '../utils/http-error';

function limitExceededHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.tooManyRequests('Too many requests, please slow down'));
}

function buildLimiter(windowMs: number, limit: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Automated tests issue many requests from the same loopback address.
    skip: () => isTest,
    handler: limitExceededHandler,
  });
}

/** General protection for the whole API surface. */
export const apiRateLimiter = buildLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX);

/** Stricter limiter for the (optional, paid) Gemini endpoints. */
export const aiRateLimiter = buildLimiter(env.RATE_LIMIT_WINDOW_MS, env.AI_RATE_LIMIT_MAX);
