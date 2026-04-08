import type { PlayerAssignmentStatus } from './auth.js';
import type { TeamStatus } from './participants.js';

export type RosterImportAction =
  | 'create'
  | 'update'
  | 'assign'
  | 'reassign'
  | 'unchanged'
  | 'invalid';

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

export interface ListAdminRosterResponse {
  readonly items: readonly AdminRosterRow[];
  readonly nextCursor: string | null;
}

export interface AdminRosterTeamOption {
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus;
  readonly memberCount: number;
}

export interface ListAdminRosterTeamsResponse {
  readonly teams: readonly AdminRosterTeamOption[];
  readonly unassignedCount: number;
}

export interface UpdateRosterAssignmentRequest {
  readonly teamId: string | null;
  readonly reason?: string;
}

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

export interface RosterImportRowInput {
  readonly workEmail: string;
  readonly displayName: string;
  readonly phoneE164?: string | null;
  readonly teamName?: string | null;
}

export interface RosterImportPreviewRequest {
  readonly rows: readonly RosterImportRowInput[];
}

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

export interface RosterImportPreviewResponse {
  readonly rows: readonly RosterImportPreviewRow[];
  readonly summary: RosterImportPreviewSummary;
}

export interface RosterImportApplyRequest {
  readonly rows: readonly RosterImportRowInput[];
}

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

export interface RosterImportApplyResponse {
  readonly rows: readonly RosterImportPreviewRow[];
  readonly summary: RosterImportApplySummary;
  readonly auditId: string;
}

export interface ListAdminRosterQuery {
  readonly q?: string;
  readonly assignmentStatus?: PlayerAssignmentStatus;
  readonly teamId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}
