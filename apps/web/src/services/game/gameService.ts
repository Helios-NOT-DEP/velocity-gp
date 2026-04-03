/**
 * Game Service
 *
 * Core business logic for game mechanics including scoring, race state,
 * and player progression. Coordinates with API and game context.
 *
 * @module services/game
 */

import { apiClient } from '../api';
import type { GetRaceStateResponse } from '@velocity-gp/api-contract';

/**
 * Get current race state for a player
 */
export async function getRaceState(
  eventId: string,
  playerId: string
): Promise<GetRaceStateResponse> {
  const response = await apiClient.get<GetRaceStateResponse>(
    `/events/${eventId}/players/${playerId}/race-state`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch race state: ${response.status}`);
  }

  return response.data;
}

/**
 * Calculate score from hazard encounters
 * Formula: base score - (hazard_count * hazard_ratio)
 */
export function calculateScore(
  baseScore: number,
  hazardsEncountered: Array<{ ratio: number }>,
  additionalBonus: number = 0
): number {
  const hazardPenalty = hazardsEncountered.reduce((acc, hazard) => acc + hazard.ratio, 0);
  return Math.max(0, baseScore - hazardPenalty + additionalBonus);
}

/**
 * Determine if player is in pit stop
 */
export function isInPitStop(status: string): boolean {
  return status === 'IN_PIT';
}

/**
 * Format race time for display
 */
export function formatRaceTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
