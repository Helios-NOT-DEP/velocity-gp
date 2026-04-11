/**
 * @file auth.ts
 * @description Standardized data definitions governing system Authentication and Authorization.
 * Handles the structures for obtaining magic links, securely verifying sessions, mapping User Identity
 * scopes, and making client-facing routing decisions natively driven by an established Auth Session.
 */

import type { TeamStatus } from './participants.js';

/**
 * Defines the macro security boundary grouping for an authenticated session.
 * Defines access rights across the platform functionality spectrum.
 */
export type AuthSessionRole = 'admin' | 'helios' | 'player';

/**
 * Captures a player's progress through the registration flowchart during an event.
 */
export type PlayerAssignmentStatus = 'ASSIGNED_PENDING' | 'ASSIGNED_ACTIVE' | 'UNASSIGNED';

/**
 * Client payload sent to initiate the passwordless Magic Link authentication process.
 */
export interface RequestMagicLinkRequest {
  readonly workEmail: string;
}

/**
 * Standard confirmation response denoting that an authentication email flow has started.
 */
export interface RequestMagicLinkResponse {
  readonly accepted: true;
  readonly message: string;
}

/**
 * Client payload sending the one-time token harvested from an emailed Magic Link.
 */
export interface VerifyMagicLinkRequest {
  readonly token: string;
}

/**
 * The consolidated session token embedded within the authenticated state of the app.
 * Denormalizes heavily queried attributes (team ID, status, roles) right into the session
 * context to save roundtrip DB lookups.
 */
export interface PlayerAuthSession {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string | null;
  /** Active PIT or RACE context for the player's team */
  readonly teamStatus: TeamStatus | null;
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly role: AuthSessionRole;
  readonly isAuthenticated: true;
  readonly email: string;
  readonly displayName: string;
}

/**
 * Returned once a Magic Link token is validated. Yields a secure session representation
 * and context on where the User should be redirected organically.
 */
export interface VerifyMagicLinkResponse {
  readonly sessionToken: string;
  readonly session: PlayerAuthSession;
  // Canonical player routes after story #55 route alignment.
  readonly redirectPath: '/team-setup' | '/race' | '/waiting-assignment';
}

/**
 * A generalized envelope for returning generic user context directly via the `/session` endpoint.
 */
export interface SessionResponse {
  readonly session: PlayerAuthSession;
}

/**
 * Dedicated payload explicitly informing the frontend routing mechanics of the layout
 * appropriate for the player's current state (unassigned player vs team-allocated).
 */
export interface RoutingDecisionResponse {
  readonly assignmentStatus: PlayerAssignmentStatus;
  // Canonical player routes after story #55 route alignment.
  readonly redirectPath: '/team-setup' | '/race' | '/waiting-assignment';
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string | null;
}
