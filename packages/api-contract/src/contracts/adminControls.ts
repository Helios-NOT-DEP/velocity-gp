import type { RaceControlState } from './raceState.js';
import type { TeamStatus } from './participants.js';

export type AdminActionType =
  | 'RACE_PAUSED'
  | 'RACE_RESUMED'
  | 'HELIOS_ASSIGNED'
  | 'HELIOS_REVOKED'
  | 'PIT_MANUAL_ENTER'
  | 'PIT_MANUAL_CLEAR'
  | 'QR_HAZARD_RANDOMIZER_UPDATED'
  | 'SCORE_RESET'
  | 'ROSTER_IMPORTED'
  | 'ROSTER_ASSIGNED'
  | 'ROSTER_REASSIGNED'
  | 'ROSTER_UNASSIGNED';

export interface UpdateRaceControlRequest {
  readonly state: RaceControlState;
  readonly reason?: string;
}

export interface UpdateRaceControlResponse {
  readonly eventId: string;
  readonly state: RaceControlState;
  readonly updatedAt: string;
  readonly auditId: string;
}

export interface ManualPitControlRequest {
  readonly action: 'ENTER_PIT' | 'CLEAR_PIT';
  readonly pitStopExpiresAt?: string;
  readonly reason?: string;
}

export interface ManualPitControlResponse {
  readonly eventId: string;
  readonly teamId: string;
  readonly status: TeamStatus;
  readonly pitStopExpiresAt: string | null;
  readonly updatedAt: string;
  readonly auditId: string;
}

export interface UpdateHeliosRoleRequest {
  readonly isHelios: boolean;
  readonly reason?: string;
}

export interface UpdateHeliosRoleResponse {
  readonly userId: string;
  readonly isHelios: boolean;
  readonly updatedAt: string;
  readonly auditId: string;
}

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
