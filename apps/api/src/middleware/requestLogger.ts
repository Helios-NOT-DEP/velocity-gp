import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.js';

export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationInMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info('request completed', {
      requestId: response.locals.requestId,
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      query: request.query,
      params: request.params,
      statusCode: response.statusCode,
      durationInMs,
    });
  });

  next();
}
