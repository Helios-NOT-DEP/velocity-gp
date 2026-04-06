export type AuthRole = 'admin' | 'helios' | 'player' | 'anonymous';

export interface AuthSession {
  userId: string | null;
  role: AuthRole;
  isAuthenticated: boolean;
  email?: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'velocitygp.auth.session';

export const anonymousSession: AuthSession = {
  userId: null,
  role: 'anonymous',
  isAuthenticated: false,
};

export function isAuthenticatedSession(session: AuthSession): boolean {
  return session.isAuthenticated && session.role !== 'anonymous' && session.userId !== null;
}

export function isAdminSession(session: AuthSession): boolean {
  return isAuthenticatedSession(session) && session.role === 'admin';
}

export function isAuthRole(value: string): value is AuthRole {
  return value === 'admin' || value === 'helios' || value === 'player' || value === 'anonymous';
}
