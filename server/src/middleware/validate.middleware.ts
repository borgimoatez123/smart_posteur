import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/http-error';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export interface FieldIssue {
  field: string;
  message: string;
}

export function formatZodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

function replaceRequestProperty(req: object, property: 'body' | 'query' | 'params', value: unknown): void {
  Object.defineProperty(req, property, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Validates and coerces request input with Zod before the controller runs.
 * Validation failures become explicit 400 responses (never silent fallbacks).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) {
        replaceRequestProperty(req, 'params', schemas.params.parse(req.params));
      }
      if (schemas.query) {
        replaceRequestProperty(req, 'query', schemas.query.parse(req.query));
      }
      if (schemas.body) {
        replaceRequestProperty(req, 'body', schemas.body.parse(req.body));
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          AppError.badRequest('Request validation failed', {
            issues: formatZodIssues(error),
          }, 'VALIDATION_ERROR'),
        );
        return;
      }
      next(error);
    }
  };
}
