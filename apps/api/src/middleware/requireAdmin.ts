import type { NextFunction, Request, Response } from 'express';
import { resolveRequestAuthContext, setRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/appError.js';

export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  // #TODO(#12): Validate Auth.js session/JWT from server-managed cookie and map claims to admin role.
  // Transitional path accepts bearer token or legacy x-user-* headers via requestAuth helper.
  const authContext = resolveRequestAuthContext(request);
  if (!authContext) {
    throw new UnauthorizedError('Authentication is required.');
  }

  if (authContext.role !== 'admin') {
    throw new ForbiddenError('Admin access is required.');
  }

  setRequestAuthContext(response, authContext);
  next();
}
