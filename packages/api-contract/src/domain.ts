export type RaceStatus = 'IN_PIT' | 'RACING' | 'FINISHED';
export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
export type RescueStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface GetRaceStateResponse {
  readonly playerId: string;
  readonly eventId: string;
  readonly currentLocation: string;
  readonly teamId: string;
  readonly hazardsEncountered: string[];
  readonly score: number;
  readonly status: RaceStatus;
}

export interface HazardStatusUpdateRequest {
  readonly hazardId: string;
  readonly status: 'ENCOUNTERED' | 'RESOLVED';
}

export interface HazardStatusUpdateResponse extends HazardStatusUpdateRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly updatedAt: string;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly score: number;
  readonly memberCount: number;
}

export interface CreatePlayerRequest {
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
}

export interface UpdatePlayerRequest {
  readonly name?: string;
}

export interface PlayerProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
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
  readonly members: string[];
  readonly score: number;
}

export interface EventSummary {
  readonly id: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: EventStatus;
}

export interface Hazard {
  readonly id: string;
  readonly name: string;
  readonly ratio: number;
  readonly description: string;
  readonly eventId: string;
}

export interface ScanHazardRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly qrCode: string;
}

export interface ScanHazardResponse {
  readonly hazardId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly recognized: boolean;
  readonly scannedAt: string;
}

export interface InitiateRescueRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly reason?: string;
}

export interface HeliosRescueFlow {
  readonly playerId: string;
  readonly eventId: string;
  readonly initiatedAt: string;
  readonly status: RescueStatus;
}

export interface RescueCompletionResponse {
  readonly playerId: string;
  readonly completedAt: string;
  readonly status: Extract<RescueStatus, 'COMPLETED'>;
}
