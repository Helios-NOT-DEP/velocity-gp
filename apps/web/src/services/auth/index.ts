/**
 * Auth Services
 */

export {
  requestMagicLink,
  verifyMagicLink,
  getRoutingDecision,
  signIn,
  signOut,
  getSession,
  savePlayerSession,
  sendVerificationEmail,
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SESSION_TOKEN_STORAGE_KEY,
  AUTH_SESSION_UPDATED_EVENT,
} from './authClient';
export type { AuthCredentials, AuthUser, PlayerSessionContext } from './authClient';
export type { AuthSession, AuthRole, AuthAssignmentStatus } from './authTypes';
export { anonymousSession, isAdminSession, isAuthenticatedSession } from './authTypes';
