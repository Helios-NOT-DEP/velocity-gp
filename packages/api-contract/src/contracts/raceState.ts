/**
 * @file raceState.ts
 * @description Exposes global telemetry metrics surrounding an active race.
 * Allows frontend applications connected to `GameContext` to query their active
 * point accumulations, hazard constraints, and race suspension metadata.
 */

import type { TeamStatus } from './participants.js';

/**
 * Defines if the underlying gameplay mechanics (scoring, racing, scanning) are currently running
 * or administratively halted.
 */
export type RaceControlState = 'ACTIVE' | 'PAUSED';

/**
 * Aggressive payload that denormalizes multiple domains (Score, Hazards, Race Admin, Team Constraints)
 * into a single fast-delivery state blob. This guarantees clients render perfectly synchronized information
 * upon initial load or reconnect without making cascading subsequent sub-queries.
 */
export interface GetRaceStateResponse {
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus;
  readonly status: TeamStatus;
  readonly raceControlState: RaceControlState;
  /** Expresses if the client-side QR scanner mechanisms should be permitted by the UI */
  readonly scannerEnabled: boolean;
  /** Represents the timestamp when a severe pit penalty mechanically expires. null if no penalty */
  readonly pitStopExpiresAt: string | null;
  readonly currentLocation: string;
  readonly hazardsEncountered: string[];
  readonly score: number;
  readonly individualScore: number;
  readonly updatedAt: string;
}
