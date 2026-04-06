export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
export type TeamStatus = 'PENDING' | 'ACTIVE' | 'IN_PIT';
export type PlayerStatus = 'RACING' | 'IN_PIT' | 'FINISHED';
export type RescueStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface EventSummary {
  readonly id: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: EventStatus;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly score: number;
  readonly memberCount: number;
  readonly status: TeamStatus;
}

export interface CreatePlayerRequest {
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
  readonly teamId?: string;
}

export interface UpdatePlayerRequest {
  readonly name?: string;
  readonly teamId?: string | null;
}

export interface PlayerProfile {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
  readonly teamId: string | null;
  readonly status: PlayerStatus;
  readonly individualScore: number;
  readonly isFlaggedForReview: boolean;
  readonly joinedAt: string;
  readonly createdAt: string;
}

export interface CreateTeamRequest {
  readonly name: string;
  readonly eventId: string;
}

export interface JoinTeamRequest {
  readonly playerId: string;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly eventId: string;
  readonly status: TeamStatus;
  readonly pitStopExpiresAt: string | null;
  readonly members: string[];
  readonly score: number;
}

export interface InitiateRescueRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly heliosQrId?: string;
  readonly reason?: string;
}

export interface HeliosRescueFlow {
  readonly id: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly rescuerUserId: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly status: RescueStatus;
}

export interface RescueCompletionResponse {
  readonly playerId: string;
  readonly completedAt: string;
  readonly status: Extract<RescueStatus, 'COMPLETED'>;
}
