import type { Request, Response } from 'express';
import type { AuthRole, RequestAuthContext } from '../types/auth.js';
import { verifySessionToken } from '../services/authTokens.js';

interface AuthResponseLocals {
  auth?: RequestAuthContext;
}

const AUTH_SESSION_COOKIE_NAME = 'velocitygp_session';

function parseCookieValue(cookieHeaderValue: string | undefined, name: string): string | null {
  if (!cookieHeaderValue) {
    return null;
  }

  const cookiePairs = cookieHeaderValue.split(';');
  for (const cookiePair of cookiePairs) {
    const [cookieName, ...cookieValueParts] = cookiePair.split('=');
    if (!cookieName || cookieValueParts.length === 0) {
      continue;
    }

    if (cookieName.trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(cookieValueParts.join('=').trim());
    } catch {
      return cookieValueParts.join('=').trim();
    }
  }

  return null;
}

export function resolveRequestAuthContext(request: Request): RequestAuthContext | null {
  const authorizationHeader = request.header('authorization');
  const [scheme, bearerToken] = (authorizationHeader ?? '').split(' ');
  const authCookieToken = parseCookieValue(request.header('cookie'), AUTH_SESSION_COOKIE_NAME);
  const token = scheme?.toLowerCase() === 'bearer' && bearerToken ? bearerToken : authCookieToken;

  if (token) {
    try {
      // Primary auth path: parse and verify signed session token.
      const claims = verifySessionToken(token);
      return {
        userId: claims.userId,
        role: claims.role,
      };
    } catch {
      // Fall back to legacy headers for compatibility in tests/local tooling.
    }
  }

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
