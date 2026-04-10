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

interface AuthCredentials {
  email: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

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

function clearStoredSession(): void {
  const storage = getBrowserStorage();
  storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  storage?.removeItem(AUTH_SESSION_TOKEN_STORAGE_KEY);
  emitSessionUpdatedEvent();
}

function persistSession(session: AuthSession, sessionToken: string): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  storage.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, sessionToken);
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
  persistSession(normalizedSession, response.data.sessionToken);

  return response.data;
}

export async function getSession(): Promise<AuthSession> {
  const storedToken = readAuthTokenFromStorage();
  if (!storedToken) {
    return readSessionFromStorage();
  }

  const response = await apiClient.get<SessionResponse>(authEndpoints.getSession, undefined);
  if (!response.ok || !response.data) {
    clearStoredSession();
    return anonymousSession;
  }

  const normalizedSession = normalizeSessionFromResponse(response.data.session);
  // Write session to storage silently (no event) — this is a passive refresh, not a
  // session transition. Emitting the event here would cause an infinite loop because
  // GameContext listens for it and calls getSession() again.
  const storage = getBrowserStorage();
  storage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
  storage?.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, storedToken);
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
  clearStoredSession();
}

export { AUTH_SESSION_STORAGE_KEY, AUTH_SESSION_TOKEN_STORAGE_KEY, AUTH_SESSION_UPDATED_EVENT };
export type { AuthCredentials, AuthUser };
