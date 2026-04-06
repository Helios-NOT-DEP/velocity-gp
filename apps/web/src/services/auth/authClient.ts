/**
 * Authentication Service
 *
 * Handles user authentication flows including login, logout, and session management.
 * Currently frontend-only; will integrate with Auth.js + backend when available.
 *
 * @module services/auth
 */

import {
  anonymousSession,
  AUTH_SESSION_STORAGE_KEY,
  type AuthSession,
  type AuthRole,
  isAuthRole,
} from './authTypes';

interface AuthCredentials {
  email: string;
  password?: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

/**
 * Sign in user with email
 * @param credentials - User email and optional password
 * @returns Promise resolving to authenticated user
 */
export async function signIn(_credentials: AuthCredentials): Promise<AuthUser> {
  // TODO: Integrate with Auth.js backend when available
  throw new Error('Authentication not yet implemented');
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  getBrowserStorage()?.removeItem(AUTH_SESSION_STORAGE_KEY);
}

/**
 * Get current session
 */
export async function getSession(): Promise<AuthSession> {
  // #TODO(#12): Replace placeholder session logic with Auth.js magic-link session retrieval and role hydration.
  return readSessionFromStorage();
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(_email: string): Promise<void> {
  // TODO: Implement with SendGrid
}

function readSessionFromStorage(): AuthSession {
  const rawSession = getBrowserStorage()?.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawSession) {
    return anonymousSession;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AuthSession> & { role?: string };
    const role = parsed.role ?? 'anonymous';

    if (!isAuthRole(role)) {
      return anonymousSession;
    }

    const normalizedRole: AuthRole = role;
    const userId =
      typeof parsed.userId === 'string' && parsed.userId.length > 0 ? parsed.userId : null;
    const isAuthenticated =
      Boolean(parsed.isAuthenticated) && userId !== null && normalizedRole !== 'anonymous';

    return {
      userId,
      role: isAuthenticated ? normalizedRole : 'anonymous',
      isAuthenticated,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    };
  } catch {
    return anonymousSession;
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  return globalThis.localStorage;
}

export { AUTH_SESSION_STORAGE_KEY };
export type { AuthCredentials, AuthUser };
