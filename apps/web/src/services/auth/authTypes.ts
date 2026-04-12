export type AuthRole = 'admin' | 'helios' | 'player' | 'anonymous';
export type AuthAssignmentStatus = 'ASSIGNED_PENDING' | 'ASSIGNED_ACTIVE' | 'UNASSIGNED';

export interface AuthSession {
  userId: string | null;
  playerId?: string;
  eventId?: string;
  teamId?: string | null;
  teamStatus?: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null;
  assignmentStatus?: AuthAssignmentStatus;
  role: AuthRole;
  isAuthenticated: boolean;
  email?: string;
  displayName?: string;
  /**
   * Player context — populated after the backend resolves the magic-link
   * callback and returns the player record for this event.
   *
   * These three IDs are all the Garage page needs to make API calls.
   * They are stored in localStorage alongside the rest of the session so the
   * player can refresh the page without losing their place.
   *
   * - playerId: the Player row ID (e.g. "player-lina-active")
   * - teamId:   the Team row ID the player was pre-assigned to
   * - eventId:  the Event row ID for the current race
   */
  playerId?: string;
  teamId?: string;
  eventId?: string;
}

// Storage/event keys are shared across hooks, context, and route guards.
export const AUTH_SESSION_STORAGE_KEY = 'velocitygp.auth.session';
export const AUTH_SESSION_TOKEN_STORAGE_KEY = 'velocitygp.auth.token';
export const AUTH_SESSION_UPDATED_EVENT = 'velocitygp.auth.session.updated';

export const anonymousSession: AuthSession = {
  userId: null,
  role: 'anonymous',
  isAuthenticated: false,
};

export function isAuthenticatedSession(session: AuthSession): boolean {
  // Require explicit user id and non-anonymous role to avoid half-hydrated states.
  return session.isAuthenticated && session.role !== 'anonymous' && session.userId !== null;
}

export function isAdminSession(session: AuthSession): boolean {
  return isAuthenticatedSession(session) && session.role === 'admin';
}

export function isAuthRole(value: string): value is AuthRole {
  return value === 'admin' || value === 'helios' || value === 'player' || value === 'anonymous';
}
