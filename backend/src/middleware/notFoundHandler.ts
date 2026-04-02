import type { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '../utils/appError.js';

export function notFoundHandler(request: Request, _response: Response, next: NextFunction): void {
  next(new NotFoundError(`No route found for ${request.method} ${request.originalUrl}.`));
}
