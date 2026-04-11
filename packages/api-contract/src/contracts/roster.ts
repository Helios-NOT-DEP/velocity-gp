/**
 * @file roster.ts
 * @description Contracts pertaining to roster uploads, bulk team assignments,
 * and list queries. Powers the Admin portals where planners map incoming players
 * to actual teams before Race Day.
 */

import type { PlayerAssignmentStatus } from './auth.js';
import type { TeamStatus } from './participants.js';

/**
 * Identifies the logical transformation calculated when a roster row
 * is compared against existing database states.
 */
export type RosterImportAction =
  | 'create'
  | 'update'
  | 'assign'
  | 'reassign'
  | 'unchanged'
  | 'invalid';

/**
 * Represents a single unified player profile flattened for viewing
 * directly in an admin datatable. Avoids deep associations and presents string literals.
 */
export interface AdminRosterRow {
  readonly playerId: string;
  readonly userId: string;
  readonly eventId: string;
  readonly workEmail: string;
  readonly displayName: string;
  readonly phoneE164: string | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamStatus: TeamStatus | null;
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly joinedAt: string;
  readonly updatedAt: string;
}

/**
 * Standard collection list containing rows of participant representations in bulk.
 */
export interface ListAdminRosterResponse {
  readonly items: readonly AdminRosterRow[];
  readonly nextCursor: string | null;
}

/**
 * Projection specifying high level metrics of an instantiated Team for
 * quick association checking (how many people are packed in this potential team)?
 */
export interface AdminRosterTeamOption {
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus;
  readonly memberCount: number;
}

/**
 * A specialized summary list summarizing Teams solely for allocation dropdowns
 * alongside the current unassigned player footprint.
 */
export interface ListAdminRosterTeamsResponse {
  readonly teams: readonly AdminRosterTeamOption[];
  readonly unassignedCount: number;
}

/**
 * Administrative payload to rip a player from their existing team and
 * forcefully assign them elsewhere.
 */
export interface UpdateRosterAssignmentRequest {
  readonly teamId: string | null;
  readonly reason?: string;
}

/**
 * Outcome payload illustrating the deltas resulting from an admin-forced team assignment jump.
 */
export interface UpdateRosterAssignmentResponse {
  readonly playerId: string;
  readonly eventId: string;
  readonly previousTeamId: string | null;
  readonly previousTeamName: string | null;
  readonly previousTeamStatus: TeamStatus | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamStatus: TeamStatus | null;
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly updatedAt: string;
  readonly auditId: string | null;
}

/**
 * Format expected when submitting a mass list of players from a spreadsheet.
 */
export interface RosterImportRowInput {
  readonly workEmail: string;
  readonly displayName: string;
  readonly phoneE164?: string | null;
  readonly teamName?: string | null;
}

/**
 * Wrap request payload representing a Dry Run request against uploaded roster entries.
 */
export interface RosterImportPreviewRequest {
  readonly rows: readonly RosterImportRowInput[];
}

/**
 * Evaluates the proposed change for a specific individual during a dry-run check.
 */
export interface RosterImportPreviewRow {
  readonly rowNumber: number;
  readonly workEmail: string;
  readonly normalizedWorkEmail: string;
  readonly displayName: string;
  readonly phoneE164: string | null;
  readonly teamName: string | null;
  readonly action: RosterImportAction;
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

/**
 * High-level counts detailing the expected blast radius if a bulk Roster CSV is applied.
 */
export interface RosterImportPreviewSummary {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly create: number;
  readonly update: number;
  readonly assign: number;
  readonly reassign: number;
  readonly unchanged: number;
}

/**
 * Represents the comprehensive readout evaluated by the server prior to finalizing an import list.
 */
export interface RosterImportPreviewResponse {
  readonly rows: readonly RosterImportPreviewRow[];
  readonly summary: RosterImportPreviewSummary;
}

/**
 * Final execution request carrying parsed roster definitions intended to be written to DB.
 */
export interface RosterImportApplyRequest {
  readonly rows: readonly RosterImportRowInput[];
}

/**
 * Describes the concrete DB mutations that successfully occurred after import apply processed.
 */
export interface RosterImportApplySummary {
  readonly total: number;
  readonly processed: number;
  readonly invalid: number;
  readonly createdUsers: number;
  readonly updatedUsers: number;
  readonly createdPlayers: number;
  readonly assigned: number;
  readonly reassigned: number;
  readonly unchanged: number;
  readonly createdTeams: number;
}

/**
 * Represents the finalized completion feedback of a mass DB update triggered by a roster import.
 */
export interface RosterImportApplyResponse {
  readonly rows: readonly RosterImportPreviewRow[];
  readonly summary: RosterImportApplySummary;
  readonly auditId: string;
}

/**
 * Search filter payload for looking up specific subsets of a participant list.
 */
export interface ListAdminRosterQuery {
  readonly q?: string;
  readonly assignmentStatus?: PlayerAssignmentStatus;
  readonly teamId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}
