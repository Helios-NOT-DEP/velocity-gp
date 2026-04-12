import type { NextFunction, Request, Response } from 'express';

import { resolveRequestAuthContext, setRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/appError.js';

/**
 * Middleware that enforces the request is from any authenticated game participant.
 *
 * Accepts sessions with role `player`, `helios`, or `admin`. Unlike `requireAdmin`,
 * this does not enforce a specific role — it only guarantees the caller has a valid,
 * verified session. Downstream handlers that need stricter enforcement (e.g., confirming
 * the caller *is* the target player) should perform that check themselves using
 * `getRequestAuthContext(response)`.
 */
export function requirePlayer(request: Request, response: Response, next: NextFunction): void {
  const authContext = resolveRequestAuthContext(request);

  if (!authContext) {
    throw new UnauthorizedError('Authentication is required.');
  }

  // Any authenticated account with player/admin capability can access player endpoints.
  // Legacy role fallback remains for backward compatibility with older session shapes.
  const hasLegacyRole =
    authContext.role === 'player' || authContext.role === 'helios' || authContext.role === 'admin';
  if (!authContext.capabilities.player && !authContext.capabilities.admin && !hasLegacyRole) {
    throw new ForbiddenError('A valid player session is required.');
  }

  setRequestAuthContext(response, authContext);
  next();
}
