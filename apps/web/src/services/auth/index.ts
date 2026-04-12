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
  sendVerificationEmail,
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SESSION_TOKEN_STORAGE_KEY,
  AUTH_SESSION_UPDATED_EVENT,
} from './authClient';
export type { AuthCredentials, AuthUser } from './authClient';
export type { AuthSession, AuthRole, AuthAssignmentStatus, AuthCapabilities } from './authTypes';
export {
  anonymousSession,
  hasPlayerCapability,
  isAdminSession,
  isAuthenticatedSession,
  isHeliosMemberSession,
} from './authTypes';
