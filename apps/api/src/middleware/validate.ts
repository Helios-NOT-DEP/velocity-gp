import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { ValidationError } from '../utils/appError.js';

export function validate<T>(
  schema: ZodType<T>,
  source: 'body' | 'params' | 'query' = 'body'
): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      const details = result.error.flatten();
      next(new ValidationError('Request validation failed.', { details }));
      return;
    }

    Object.defineProperty(request, source, {
      value: result.data,
      configurable: true,
      writable: true,
      enumerable: true,
    });
    next();
  };
}
