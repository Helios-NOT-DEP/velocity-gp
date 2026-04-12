// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    get: apiGetMock,
    post: vi.fn(),
  },
  authEndpoints: {
    getSession: '/auth/session',
    requestMagicLink: '/auth/magic-link/request',
    verifyMagicLink: '/auth/magic-link/verify',
    getRoutingDecision: '/auth/routing-decision',
  },
}));

import type { SessionResponse } from '@velocity-gp/api-contract';
import {
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SESSION_TOKEN_STORAGE_KEY,
  AUTH_SESSION_UPDATED_EVENT,
  getSession,
} from '@/services/auth/authClient';
import type { AuthSession } from '@/services/auth/authTypes';
import { anonymousSession } from '@/services/auth/authTypes';

function createStoredSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    userId: 'user-admin-1',
    playerId: 'player-1',
    eventId: 'event-1',
    teamId: 'team-1',
    teamStatus: 'ACTIVE',
    assignmentStatus: 'ASSIGNED_ACTIVE',
    role: 'admin',
    isAuthenticated: true,
    email: 'admin@velocitygp.dev',
    displayName: 'Admin Fixture',
    ...overrides,
  };
}

function createApiSessionResponse(sessionOverrides: Partial<SessionResponse['session']> = {}) {
  return {
    session: {
      userId: 'user-admin-server',
      playerId: 'player-server',
      eventId: 'event-server',
      teamId: 'team-server',
      teamStatus: 'ACTIVE' as const,
      assignmentStatus: 'ASSIGNED_ACTIVE' as const,
      role: 'admin' as const,
      isAuthenticated: true as const,
      email: 'server-admin@velocitygp.dev',
      displayName: 'Server Admin',
      ...sessionOverrides,
    },
  };
}

describe('authClient.getSession', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    window.localStorage.clear();
  });

  it('retains stored auth state when session refresh throws a transport error', async () => {
    const storedSession = createStoredSession();
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    window.localStorage.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, 'session-token-123');
    apiGetMock.mockRejectedValueOnce(new Error('network unavailable'));

    const session = await getSession();

    expect(apiGetMock).toHaveBeenCalledWith('/auth/session', undefined);
    expect(session).toEqual(storedSession);
    expect(JSON.parse(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ?? '{}')).toEqual(
      storedSession
    );
    expect(window.localStorage.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY)).toBe('session-token-123');
  });

  it('rehydrates from server session when no bearer token exists in storage', async () => {
    const staleStoredSession = createStoredSession({ userId: 'stale-user-id', role: 'player' });
    const apiSessionResponse = createApiSessionResponse();
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(staleStoredSession));
    window.localStorage.removeItem(AUTH_SESSION_TOKEN_STORAGE_KEY);

    apiGetMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: apiSessionResponse,
    });

    const session = await getSession();

    expect(apiGetMock).toHaveBeenCalledWith('/auth/session', undefined);
    expect(session).toEqual({
      userId: 'user-admin-server',
      playerId: 'player-server',
      eventId: 'event-server',
      teamId: 'team-server',
      teamStatus: 'ACTIVE',
      assignmentStatus: 'ASSIGNED_ACTIVE',
      role: 'admin',
      isAuthenticated: true,
      email: 'server-admin@velocitygp.dev',
      displayName: 'Server Admin',
    });
    expect(JSON.parse(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ?? '{}')).toEqual(
      session
    );
    expect(window.localStorage.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('clears local session when server reports an authoritative auth failure', async () => {
    const sessionUpdatedSpy = vi.fn();
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, sessionUpdatedSpy);

    const storedSession = createStoredSession();
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    window.localStorage.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, 'expired-token-123');
    apiGetMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      data: undefined,
      error: {
        code: 'AUTH_INVALID_SESSION',
        message: 'Session is invalid or expired.',
      },
    });

    const session = await getSession();

    expect(session).toEqual(anonymousSession);
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionUpdatedSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, sessionUpdatedSpy);
  });

  it('clears local session when server reports AUTH_ASSIGNMENT_REQUIRED', async () => {
    const storedSession = createStoredSession();
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    window.localStorage.setItem(AUTH_SESSION_TOKEN_STORAGE_KEY, 'session-token-123');
    apiGetMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      data: undefined,
      error: {
        code: 'AUTH_ASSIGNMENT_REQUIRED',
        message: 'Player is not currently assigned to a team.',
      },
    });

    const session = await getSession();

    expect(session).toEqual(anonymousSession);
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('does not emit session-updated when already anonymous on AUTH_MISSING_TOKEN', async () => {
    const sessionUpdatedSpy = vi.fn();
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, sessionUpdatedSpy);

    apiGetMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      data: undefined,
      error: {
        code: 'AUTH_MISSING_TOKEN',
        message: 'Authentication is required.',
      },
    });

    const session = await getSession();

    expect(session).toEqual(anonymousSession);
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionUpdatedSpy).not.toHaveBeenCalled();

    window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, sessionUpdatedSpy);
  });
});
