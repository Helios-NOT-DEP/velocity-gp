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

    // Express 5 makes `request.query` and `request.params` read-only getters,
    // so we can only replace properties in-place rather than reassigning.
    if (source === 'body') {
      request.body = result.data;
    } else {
      const target = request[source] as Record<string, unknown>;
      const parsed = result.data as Record<string, unknown>;
      for (const key of Object.keys(target)) {
        if (!(key in parsed)) delete target[key];
      }
      Object.assign(target, parsed);
    }
    next();
  };
}
