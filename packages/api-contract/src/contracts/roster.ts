/**
 * @file roster.ts
 * @description Contracts pertaining to roster uploads, bulk team assignments,
 * and list queries. Powers the Admin portals where planners map incoming players
 * to actual teams before Race Day.
 */

import type { PlayerAssignmentStatus } from './auth.js';
import type { TeamStatus } from './participants.js';
import type { ScanOutcome } from './scans.js';

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
  readonly isHelios: boolean;
  readonly isFlaggedForReview: boolean;
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
  readonly isFlaggedForReview?: boolean;
  readonly teamId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Team-member projection used in the Admin team detail view.
 */
export interface AdminTeamDetailMember {
  readonly playerId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly workEmail: string;
  readonly individualScore: number;
  readonly joinedAt: string;
  readonly rank: number;
  /** The player's approved self-description, or null if not yet submitted. */
  readonly selfDescription: string | null;
  /** Current submission status for this player's description. */
  readonly submissionStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | null;
}

/**
 * Team-level payload returned by Admin team detail endpoints.
 */
export interface GetAdminTeamDetailResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus;
  readonly score: number;
  readonly rank: number;
  readonly pitStopExpiresAt: string | null;
  readonly keywords: readonly string[];
  readonly memberCount: number;
  readonly members: readonly AdminTeamDetailMember[];
  /** Current logo generation status for the team. */
  readonly logoStatus: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  /** URL of the generated team logo, or null if not yet generated. */
  readonly logoUrl: string | null;
}

/**
 * Request to trigger (or re-trigger) logo generation for a team from the admin surface.
 * All context is taken from path params; no body fields are required.
 */
export type AdminTriggerLogoRequest = Record<string, never>;

/**
 * Response after admin triggers logo generation.
 */
export interface AdminTriggerLogoResponse {
  readonly teamId: string;
  readonly logoStatus: 'GENERATING';
  readonly message: string;
}

/**
 * Request for admin to update a player's self-description.
 */
export interface AdminUpdateSelfDescriptionRequest {
  readonly description: string;
}

/**
 * Response after admin updates a player's self-description.
 */
export interface AdminUpdateSelfDescriptionResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly description: string;
  /** Whether logo regeneration was enqueued because all players now have approved descriptions. */
  readonly logoRegenerationEnqueued: boolean;
}

/**
 * Admin payload for manually overriding a team's score.
 */
export interface UpdateAdminTeamScoreRequest {
  readonly score: number;
  readonly reason?: string;
}

/**
 * Response payload after a successful team score update.
 */
export interface UpdateAdminTeamScoreResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly score: number;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Response payload for soft-deleting a team from active admin surfaces.
 */
export interface DeleteAdminTeamResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly deletedAt: string;
  readonly unassignedPlayerCount: number;
  readonly auditId: string;
}

/**
 * Detailed payload returned for an Admin player detail screen.
 */
export interface GetAdminPlayerDetailResponse {
  readonly eventId: string;
  readonly playerId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly workEmail: string;
  readonly phoneE164: string | null;
  readonly isFlaggedForReview: boolean;
  readonly joinedAt: string;
  readonly individualScore: number;
  readonly globalRank: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamScore: number | null;
  readonly teamRank: number | null;
}

/**
 * Admin payload for editing player contact details.
 */
export interface UpdateAdminPlayerContactRequest {
  readonly workEmail: string;
  readonly phoneE164: string | null;
  readonly reason?: string;
}

/**
 * Response payload after a successful player-contact update.
 */
export interface UpdateAdminPlayerContactResponse {
  readonly eventId: string;
  readonly playerId: string;
  readonly userId: string;
  readonly workEmail: string;
  readonly phoneE164: string | null;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Admin payload for manually creating a player in an event roster.
 */
export interface CreateAdminPlayerRequest {
  readonly workEmail: string;
  readonly displayName: string;
  readonly teamId?: string;
}

/**
 * Response payload after manually creating a player in the roster.
 */
export interface CreateAdminPlayerResponse {
  readonly eventId: string;
  readonly playerId: string;
  readonly userId: string;
  readonly workEmail: string;
  readonly displayName: string;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamStatus: TeamStatus | null;
  readonly assignmentStatus: PlayerAssignmentStatus;
  readonly joinedAt: string;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Admin payload for sending a welcome letter to a player.
 */
export interface SendAdminPlayerWelcomeRequest {
  readonly reason?: string;
}

/**
 * Response payload after attempting to dispatch a player welcome letter.
 */
export interface SendAdminPlayerWelcomeResponse {
  readonly eventId: string;
  readonly playerId: string;
  readonly userId: string;
  readonly workEmail: string;
  readonly displayName: string;
  readonly deliveryStatus: 'dispatched' | 'dispatch_failed';
  readonly auditId: string;
  readonly updatedAt: string;
}

/**
 * Supported admin review outcomes when resolving a flagged player.
 */
export type AdminPlayerReviewDecision = 'APPROVED' | 'WARNED' | 'DISQUALIFIED';

/**
 * Admin payload for resolving a flagged-player review item.
 */
export interface ResolveAdminPlayerReviewFlagRequest {
  readonly decision: AdminPlayerReviewDecision;
  readonly reason: string;
}

/**
 * Response payload after resolving (clearing) a player review flag.
 */
export interface ResolveAdminPlayerReviewFlagResponse {
  readonly eventId: string;
  readonly playerId: string;
  readonly isFlaggedForReview: boolean;
  readonly decision: AdminPlayerReviewDecision;
  readonly reason: string;
  readonly resolvedAt: string;
  readonly auditId: string;
}

/**
 * Single scan-history row for Admin player-detail views.
 */
export interface AdminPlayerScanHistoryItem {
  readonly scanId: string;
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string | null;
  readonly qrCodeId: string | null;
  readonly qrCodeLabel: string | null;
  readonly qrPayload: string;
  readonly outcome: ScanOutcome;
  readonly pointsAwarded: number;
  readonly scannedAt: string;
  readonly message: string | null;
}

/**
 * Query options for Admin player scan-history listing.
 */
export interface ListAdminPlayerScanHistoryQuery {
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Cursor-paginated scan history payload for Admin player detail views.
 */
export interface ListAdminPlayerScanHistoryResponse {
  readonly items: readonly AdminPlayerScanHistoryItem[];
  readonly nextCursor: string | null;
}
