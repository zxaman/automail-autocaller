import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../shared/errors/app-error';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Runtime request validation. Parsed output replaces the raw input so
 * controllers only ever see validated, typed data.
 */
export function validate(schema: ZodType, target: ValidationTarget = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || target;
        fieldErrors[key] ??= issue.message;
      }

      next(
        new AppError('The request could not be validated', 400, 'VALIDATION_FAILED', {
          details: { fields: fieldErrors },
        }),
      );
      return;
    }

    if (target === 'body') {
      req.body = result.data;
    } else {
      Object.defineProperty(req, target, { value: result.data, configurable: true });
    }

    next();
  };
}

/** Convenience wrapper: validating and coercing the query string. */
export function validateQuery(schema: ZodType): RequestHandler {
  return validate(schema, 'query');
}
