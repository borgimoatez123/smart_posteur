import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { AppError } from '../utils/http-error';
import { formatZodIssues } from './validate.middleware';
import { logger } from '../utils/logger';
import type { ApiErrorResponse } from '../utils/api-response';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, undefined, 'ROUTE_NOT_FOUND'));
};

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  expose: boolean;
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
      expose: error.expose,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { issues: formatZodIssues(error) },
      expose: true,
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      code: 'DATABASE_VALIDATION_ERROR',
      message: 'Stored document failed validation',
      details: Object.values(error.errors).map((issue) => ({
        field: issue.path,
        message: issue.message,
      })),
      expose: true,
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: 'INVALID_IDENTIFIER',
      message: `Invalid value for path "${error.path}"`,
      expose: true,
    };
  }

  if (isDuplicateKeyError(error)) {
    return {
      statusCode: 409,
      code: 'DUPLICATE_RECORD',
      message: 'A record with the same unique key already exists',
      expose: true,
    };
  }

  if (isBodyParserError(error)) {
    const type = (error as { type?: string }).type;
    if (type === 'entity.too.large') {
      return {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large',
        expose: true,
      };
    }
    return {
      statusCode: 400,
      code: 'MALFORMED_JSON',
      message: 'Request body is not valid JSON',
      expose: true,
    };
  }

  if (error instanceof mongoose.Error || (error as { name?: string })?.name === 'MongoServerError') {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database operation failed',
      expose: true,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Unexpected server error',
    expose: false,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

function isBodyParserError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'body' in error
  );
}

/**
 * Centralized error middleware. Unexpected errors never leak stack traces in
 * production; validation and domain errors are returned with an actionable code.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const normalized = normalizeError(error);
  const logContext = {
    err: error,
    statusCode: normalized.statusCode,
    code: normalized.code,
    method: req.method,
    url: req.originalUrl,
  };

  if (normalized.statusCode >= 500) {
    logger.error(logContext, 'Request failed');
  } else {
    logger.warn(logContext, 'Request rejected');
  }

  const body: ApiErrorResponse = {
    success: false,
    message: normalized.expose ? normalized.message : 'Unexpected server error',
    error: {
      code: normalized.code,
      ...(normalized.expose && normalized.details !== undefined ? { details: normalized.details } : {}),
    },
  };

  if (!isProduction && !normalized.expose) {
    body.error.details = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  res.status(normalized.statusCode).json(body);
};
