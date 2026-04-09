import type { NextFunction, Request, Response } from 'express';

import { errorResponse } from '@velocity-gp/api-contract/http';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/appError.js';

export function errorHandler(
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  const requestId = response.locals.requestId as string | undefined;

  if (error instanceof AppError) {
    response.status(error.statusCode).json(
      errorResponse(
        {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        { requestId }
      )
    );
    return;
  }

  logger.error('unexpected backend error', { err: error, requestId });

  response.status(500).json(
    errorResponse(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
      { requestId }
    )
  );
}
