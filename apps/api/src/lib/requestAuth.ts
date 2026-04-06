import type { Request, Response } from 'express';
import type { AuthRole, RequestAuthContext } from '../types/auth.js';

interface AuthResponseLocals {
  auth?: RequestAuthContext;
}

export function resolveRequestAuthContext(request: Request): RequestAuthContext | null {
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
