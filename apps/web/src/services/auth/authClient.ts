import type {
  RequestMagicLinkResponse,
  RoutingDecisionResponse,
  SessionResponse,
  VerifyMagicLinkResponse,
} from '@velocity-gp/api-contract';

import { authEndpoints } from '../api';
import { apiClient } from '../api';
import {
  anonymousSession,
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SESSION_TOKEN_STORAGE_KEY,
  AUTH_SESSION_UPDATED_EVENT,
  type AuthSession,
  type AuthRole,
  isAuthRole,
} from './authTypes';

/**
 * Browser auth client for magic-link/session workflows.
 *
 * Responsibilities:
 * - persist and hydrate session state from local storage
 * - emit a session-updated event for interested UI subscribers
 * - normalize API response contracts into frontend auth types
 */

interface AuthCredentials {
  email: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

/**
 * Player context received after the backend resolves a magic-link login and
 * looks up the Player record for the current event.
 *
 * Pass this to `savePlayerSession()` so Garage.tsx (and any other route that
 * needs player IDs) can read them without prop-drilling.
 */
export interface PlayerSessionContext {
  userId: string;
  email: string;
  playerId: string;
  teamId: string;
  eventId: string;
  role: AuthRole;
}

const LOGOUT_ENDPOINT = '/auth/logout';

export type MagicLinkRequestResult = RequestMagicLinkResponse;
export type MagicLinkVerifyResult = VerifyMagicLinkResponse;

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): BrowserStorage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  return globalThis.localStorage;
}

function emitSessionUpdatedEvent(): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.dispatchEvent !== 'function') {
    return;
  }

  globalThis.dispatchEvent(new globalThis.Event(AUTH_SESSION_UPDATED_EVENT));
}

function readAuthTokenFromStorage(): string | null {
  return getBrowserStorage()?.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY) ?? null;
}

function shouldClearStoredSession(response: {
  status: number;
  error?: { code?: string };
}): boolean {
  if (
    response.error?.code === 'AUTH_INVALID_SESSION' ||
    response.error?.code === 'AUTH_MISSING_TOKEN' ||
    response.error?.code === 'AUTH_ASSIGNMENT_REQUIRED'
  ) {
    return true;
  }

  return response.status === 401;
}

function clearStoredSession(): void {
  const storage = getBrowserStorage();
  const hadStoredSession = storage?.getItem(AUTH_SESSION_STORAGE_KEY) !== null;
  const hadStoredToken = storage?.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY) !== null;

  storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  storage?.removeItem(AUTH_SESSION_TOKEN_STORAGE_KEY);
  if (hadStoredSession || hadStoredToken) {
    // Clearing non-empty auth state is a transition; notify listeners immediately.
    emitSessionUpdatedEvent();
  }
}

function persistSession(session: AuthSession, sessionToken: string): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  storage.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, sessionToken);
  // Emitted for route guards/context providers that react to auth transitions.
  emitSessionUpdatedEvent();
}

function normalizeSessionFromResponse(session: SessionResponse['session']): AuthSession {
  return {
    userId: session.userId,
    playerId: session.playerId,
    eventId: session.eventId,
    teamId: session.teamId,
    teamStatus: session.teamStatus,
    assignmentStatus: session.assignmentStatus,
    role: session.role,
    isAuthenticated: session.isAuthenticated,
    email: session.email,
    displayName: session.displayName,
  };
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
      playerId: typeof parsed.playerId === 'string' ? parsed.playerId : undefined,
      eventId: typeof parsed.eventId === 'string' ? parsed.eventId : undefined,
      teamId:
        parsed.teamId === null || typeof parsed.teamId === 'string' ? parsed.teamId : undefined,
      teamStatus:
        parsed.teamStatus === null ||
        parsed.teamStatus === 'PENDING' ||
        parsed.teamStatus === 'ACTIVE' ||
        parsed.teamStatus === 'IN_PIT'
          ? parsed.teamStatus
          : undefined,
      assignmentStatus:
        parsed.assignmentStatus === 'ASSIGNED_PENDING' ||
        parsed.assignmentStatus === 'ASSIGNED_ACTIVE' ||
        parsed.assignmentStatus === 'UNASSIGNED'
          ? parsed.assignmentStatus
          : undefined,
      role: isAuthenticated ? normalizedRole : 'anonymous',
      isAuthenticated,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
    };
  } catch {
    return anonymousSession;
  }
}

export async function requestMagicLink(workEmail: string): Promise<MagicLinkRequestResult> {
  const response = await apiClient.post<RequestMagicLinkResponse>(authEndpoints.requestMagicLink, {
    workEmail,
  });

  if (!response.ok) {
    if (response.error?.code === 'AUTH_USER_NOT_FOUND') {
      throw new Error('AUTH_USER_NOT_FOUND');
    }

    throw new Error('Unable to request a magic link right now.');
  }

  if (!response.data) {
    throw new Error('Unable to request a magic link right now.');
  }

  return response.data;
}

export async function verifyMagicLink(token: string): Promise<MagicLinkVerifyResult> {
  const response = await apiClient.post<VerifyMagicLinkResponse>(authEndpoints.verifyMagicLink, {
    token,
  });

  if (!response.ok || !response.data) {
    if (response.status === 403) {
      throw new Error('AUTH_ASSIGNMENT_REQUIRED');
    }

    throw new Error('AUTH_INVALID_LINK');
  }

  const normalizedSession = normalizeSessionFromResponse(response.data.session);
  // Persist token + normalized session as the canonical signed-in state.
  persistSession(normalizedSession, response.data.sessionToken);

  return response.data;
}

/**
 * Persist the player context after the magic-link callback resolves.
 * Call this once the backend returns the player's team + event IDs so
 * Garage.tsx and other routes can read them without prop-drilling.
 */
export function savePlayerSession(context: PlayerSessionContext): void {
  const session: AuthSession = {
    userId: context.userId,
    email: context.email,
    role: context.role,
    isAuthenticated: true,
    playerId: context.playerId,
    teamId: context.teamId,
    eventId: context.eventId,
  };
  const storage = getBrowserStorage();
  if (storage) {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    emitSessionUpdatedEvent();
  }
}

export async function getSession(): Promise<AuthSession> {
  const storedToken = readAuthTokenFromStorage();
  const storedSession = readSessionFromStorage();

  let response: Awaited<ReturnType<typeof apiClient.get<SessionResponse>>>;
  try {
    response = await apiClient.get<SessionResponse>(authEndpoints.getSession, undefined);
  } catch {
    // Transport/runtime failures are non-authoritative; keep last known local session.
    return storedSession;
  }

  if (!response.ok || !response.data) {
    if (shouldClearStoredSession(response)) {
      clearStoredSession();
      return anonymousSession;
    }

    return storedSession;
  }

  const normalizedSession = normalizeSessionFromResponse(response.data.session);
  // Write session to storage silently (no event) — this is a passive refresh, not a
  // session transition. Emitting the event here would cause an infinite loop because
  // GameContext listens for it and calls getSession() again.
  const storage = getBrowserStorage();
  storage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
  if (storedToken) {
    storage?.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, storedToken);
  }
  return normalizedSession;
}

export async function getRoutingDecision(): Promise<RoutingDecisionResponse> {
  const response = await apiClient.get<RoutingDecisionResponse>(authEndpoints.getRoutingDecision);
  if (!response.ok || !response.data) {
    throw new Error('Unable to resolve routing decision.');
  }

  return response.data;
}

export async function signIn(_credentials: AuthCredentials): Promise<AuthUser> {
  throw new Error('Direct sign-in is not supported. Use requestMagicLink.');
}

export async function sendVerificationEmail(email: string): Promise<void> {
  await requestMagicLink(email);
}

export async function signOut(): Promise<void> {
  try {
    await apiClient.post<{ loggedOut: boolean }>(LOGOUT_ENDPOINT);
  } finally {
    clearStoredSession();
  }
}

export { AUTH_SESSION_STORAGE_KEY, AUTH_SESSION_TOKEN_STORAGE_KEY, AUTH_SESSION_UPDATED_EVENT };
export type { AuthCredentials, AuthUser };
