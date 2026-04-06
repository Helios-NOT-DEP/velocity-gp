import type { TeamStatus } from './participants.js';

export type RaceControlState = 'ACTIVE' | 'PAUSED';

export interface GetRaceStateResponse {
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus;
  readonly status: TeamStatus;
  readonly raceControlState: RaceControlState;
  readonly scannerEnabled: boolean;
  readonly pitStopExpiresAt: string | null;
  readonly currentLocation: string;
  readonly hazardsEncountered: string[];
  readonly score: number;
  readonly individualScore: number;
  readonly updatedAt: string;
}
