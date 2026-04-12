import type { Request, Response } from 'express';
import type { AuthRole, RequestAuthContext } from '../types/auth.js';
import { verifySessionToken } from '../services/authTokens.js';
import { resolveSessionToken } from '../services/authSessionToken.js';

interface AuthResponseLocals {
  auth?: RequestAuthContext;
}

export function resolveRequestAuthContext(request: Request): RequestAuthContext | null {
  const authorizationHeader = request.header('authorization');
  const cookieHeader = request.header('cookie');

  const bearerToken = resolveSessionToken(authorizationHeader, undefined);
  if (bearerToken) {
    try {
      // Primary auth path: parse and verify signed session token.
      const claims = verifySessionToken(bearerToken);
      return {
        userId: claims.userId,
        playerId: claims.playerId,
        role: claims.role,
      };
    } catch {
      // Fall back to legacy headers for compatibility in tests/local tooling.
    }
  }

  const cookieToken = resolveSessionToken(undefined, cookieHeader);
  if (cookieToken) {
    try {
      const claims = verifySessionToken(cookieToken);
      const legacyAuthContext = resolveLegacyHeaderAuthContext(request);

      // Preserve header-based admin compatibility when a stale non-admin cookie exists.
      if (claims.role !== 'admin' && legacyAuthContext?.role === 'admin') {
        return legacyAuthContext;
      }

      return {
        userId: claims.userId,
        playerId: claims.playerId,
        role: claims.role,
      };
    } catch {
      // Fall back to legacy headers for compatibility in tests/local tooling.
    }
  }

  return resolveLegacyHeaderAuthContext(request);
}

function resolveLegacyHeaderAuthContext(request: Request): RequestAuthContext | null {
  const userIdHeader = request.header('x-user-id');
  const userRoleHeader = request.header('x-user-role');

  if (!userIdHeader || !userRoleHeader) {
    return null;
  }

  const userId = userIdHeader.trim();
  const roleValue = userRoleHeader.trim().toLowerCase();
  if (!userId || !isAuthRole(roleValue)) {
    return null;
  }

  return {
    userId,
    role: roleValue,
  };
}

export function setRequestAuthContext(response: Response, auth: RequestAuthContext): void {
  (response.locals as AuthResponseLocals).auth = auth;
}

export function getRequestAuthContext(response: Response): RequestAuthContext | undefined {
  return (response.locals as AuthResponseLocals).auth;
}

function isAuthRole(value: string): value is AuthRole {
  return value === 'admin' || value === 'helios' || value === 'player';
}
