import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  // Preserve upstream correlation id when present, otherwise generate one per request.
  const requestId = request.header('x-request-id') ?? randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);

  next();
}
