/**
 * Authentication Service
 *
 * Handles user authentication flows including login, logout, and session management.
 * Currently frontend-only; will integrate with Auth.js + backend when available.
 *
 * @module services/auth
 */

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
export async function signIn(_credentials: AuthCredentials): Promise<AuthUser> { // eslint-disable-line @typescript-eslint/no-unused-vars
  // TODO: Integrate with Auth.js backend when available
  throw new Error('Authentication not yet implemented');
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  // TODO: Implement with Auth.js
}

/**
 * Get current session
 */
export async function getSession(): Promise<AuthUser | null> {
  // TODO: Implement session retrieval
  return null;
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(_email: string): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
  // TODO: Implement with SendGrid
}
