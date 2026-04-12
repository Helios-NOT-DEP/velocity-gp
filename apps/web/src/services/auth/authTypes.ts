export type AuthRole = 'admin' | 'helios' | 'player' | 'anonymous';
export type AuthAssignmentStatus = 'ASSIGNED_PENDING' | 'ASSIGNED_ACTIVE' | 'UNASSIGNED';

export interface AuthCapabilities {
  admin: boolean;
  player: boolean;
  heliosMember: boolean;
}

export interface AuthSession {
  userId: string | null;
  playerId?: string | null;
  eventId?: string | null;
  teamId?: string | null;
  teamStatus?: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null;
  assignmentStatus?: AuthAssignmentStatus;
  capabilities?: AuthCapabilities;
  role: AuthRole;
  isAuthenticated: boolean;
  email?: string;
  displayName?: string;
}

// Storage/event keys are shared across hooks, context, and route guards.
export const AUTH_SESSION_STORAGE_KEY = 'velocitygp.auth.session';
export const AUTH_SESSION_TOKEN_STORAGE_KEY = 'velocitygp.auth.token';
export const AUTH_SESSION_UPDATED_EVENT = 'velocitygp.auth.session.updated';

export const anonymousSession: AuthSession = {
  userId: null,
  playerId: null,
  eventId: null,
  capabilities: {
    admin: false,
    player: false,
    heliosMember: false,
  },
  role: 'anonymous',
  isAuthenticated: false,
};

export function isAuthenticatedSession(session: AuthSession): boolean {
  // Require explicit user id and non-anonymous role to avoid half-hydrated states.
  return session.isAuthenticated && session.role !== 'anonymous' && session.userId !== null;
}

export function isAdminSession(session: AuthSession): boolean {
  return (
    isAuthenticatedSession(session) &&
    (session.capabilities?.admin === true || session.role === 'admin')
  );
}

export function hasPlayerCapability(session: AuthSession): boolean {
  return (
    isAuthenticatedSession(session) &&
    (session.capabilities?.player === true ||
      session.role === 'player' ||
      session.role === 'helios')
  );
}

export function isHeliosMemberSession(session: AuthSession): boolean {
  return (
    hasPlayerCapability(session) &&
    (session.capabilities?.heliosMember === true || session.role === 'helios')
  );
}

export function isAuthRole(value: string): value is AuthRole {
  return value === 'admin' || value === 'helios' || value === 'player' || value === 'anonymous';
}
