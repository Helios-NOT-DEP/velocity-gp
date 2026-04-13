import type { NextFunction, Request, Response } from 'express';

import { resolveRequestAuthContext, setRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/appError.js';

/**
 * Middleware that enforces the request originates from an authenticated Helios user.
 *
 * Only sessions carrying role `helios` (or an admin override) are permitted through.
 * Player-only sessions are explicitly rejected. Downstream route handlers can assume
 * Helios access is granted, but the authenticated role may be either `helios` or `admin`.
 */
export function requireHelios(request: Request, response: Response, next: NextFunction): void {
  const authContext = resolveRequestAuthContext(request);

  if (!authContext) {
    throw new UnauthorizedError('Authentication is required.');
  }

  const isHelios =
    authContext.capabilities.heliosMember ||
    authContext.role === 'helios' ||
    authContext.role === 'admin';

  if (!isHelios) {
    throw new ForbiddenError('Helios access is required.');
  }

  setRequestAuthContext(response, authContext);
  next();
}
