/**
 * @file adminControls.ts
 * @description Defines the contracts and DTOs specifically tailored for Administrative capabilities.
 * This includes race controls (pauses/resumes), enforcing pit penalties manually, adjusting roles,
 * and standardizing audit logging across event administration actions.
 */

import type { RaceControlState } from './raceState.js';
import type { TeamStatus } from './participants.js';

/**
 * An exhaustive enumeration of system-level actions logged by administrative users.
 * Acts as the centralized dictionary for filtering and querying the audit trail.
 */
export type AdminActionType =
  | 'RACE_PAUSED'
  | 'RACE_RESUMED'
  | 'HELIOS_ASSIGNED'
  | 'HELIOS_REVOKED'
  | 'PIT_MANUAL_ENTER'
  | 'PIT_MANUAL_CLEAR'
  | 'QR_CREATED'
  | 'QR_STATUS_UPDATED'
  | 'QR_DELETED'
  | 'QR_HAZARD_RANDOMIZER_UPDATED'
  | 'SCORE_RESET'
  | 'ROSTER_IMPORTED'
  | 'ROSTER_ASSIGNED'
  | 'ROSTER_REASSIGNED'
  | 'ROSTER_UNASSIGNED'
  | 'EMAIL_RETURN_FLAGGED';

/**
 * Request payload for modifying the global status of an event.
 * Used primarily to halt scanning globally during an emergency or timed break.
 */
export interface UpdateRaceControlRequest {
  readonly state: RaceControlState;
  readonly reason?: string;
}

/**
 * The standardized response to successfully updating global race control state.
 * Returns the audit log ID for reference bridging.
 */
export interface UpdateRaceControlResponse {
  readonly eventId: string;
  readonly state: RaceControlState;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Request payload used by an admin or HELIOS member to manually bypass random hazard logic
 * and force a team into, or out of, a PIT state context.
 */
export interface ManualPitControlRequest {
  readonly action: 'ENTER_PIT' | 'CLEAR_PIT';
  readonly pitStopExpiresAt?: string;
  readonly reason?: string;
}

/**
 * The state reflecting the team after a manual PIT bypass command is resolved.
 */
export interface ManualPitControlResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly status: TeamStatus;
  readonly pitStopExpiresAt: string | null;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Request payload to upgrade or demote a player's underlying user role.
 * HELIOS users gain escalated permissions to support in-game rescue and moderation workflows.
 */
export interface UpdateHeliosRoleRequest {
  readonly isHelios: boolean;
  readonly reason?: string;
}

/**
 * Response when a user's role/authorization parameters have been securely modified.
 */
export interface UpdateHeliosRoleResponse {
  readonly userId: string;
  readonly isHelios: boolean;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * The Data Transfer structure for a unified administrative log snippet.
 * Guarantees that regardless of which system modifies game state, a clear
 * ledger entry captures Who did What to Whom.
 */
export interface AdminAuditEntry {
  readonly id: string;
  readonly eventId: string;
  readonly actorUserId: string;
  readonly actionType: AdminActionType;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly details?: Record<string, unknown>;
  readonly createdAt: string;
}
