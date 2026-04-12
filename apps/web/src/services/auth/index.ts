/**
 * Auth Services
 */

export {
  signIn,
  signOut,
  getSession,
  savePlayerSession,
  sendVerificationEmail,
  AUTH_SESSION_STORAGE_KEY,
} from './authClient';
export type { AuthCredentials, AuthUser, PlayerSessionContext } from './authClient';
export type { AuthSession, AuthRole } from './authTypes';
export { anonymousSession, isAdminSession, isAuthenticatedSession } from './authTypes';
