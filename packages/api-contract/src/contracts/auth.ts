import type { TeamStatus } from './participants.js';

export type AuthSessionRole = 'admin' | 'helios' | 'player';

export type PlayerAssignmentStatus = 'ASSIGNED_PENDING' | 'ASSIGNED_ACTIVE' | 'UNASSIGNED';

export interface RequestMagicLinkRequest {
  readonly workEmail: string;
}

export interface RequestMagicLinkResponse {
  readonly accepted: true;
  readonly message: string;
}

export interface VerifyMagicLinkRequest {
  readonly token: string;
}

export interface PlayerAuthSession {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string | null;
  readonly teamStatus: TeamStatus | null;
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly role: AuthSessionRole;
  readonly isAuthenticated: true;
  readonly email: string;
  readonly displayName: string;
}

export interface VerifyMagicLinkResponse {
  readonly sessionToken: string;
  readonly session: PlayerAuthSession;
  readonly redirectPath: '/garage' | '/race-hub' | '/waiting-assignment';
}

export interface SessionResponse {
  readonly session: PlayerAuthSession;
}

export interface RoutingDecisionResponse {
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly redirectPath: '/garage' | '/race-hub' | '/waiting-assignment';
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string | null;
}
