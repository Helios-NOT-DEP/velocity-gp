/**
 * Race Logic & Rules
 *
 * Implements core race mechanics and rules as defined in:
 * docs/Velocity GP BDD Specifications.md
 *
 * @module services/game/raceLogic
 */

export interface RaceEvent {
  type: 'hazard_encountered' | 'rescue_initiated' | 'race_completed' | 'location_changed';
  timestamp: Date;
  playerId: string;
  data: unknown;
}

/**
 * Track race events for audit trail and leaderboard
 */
export class RaceEventLog {
  private events: RaceEvent[] = [];

  addEvent(event: RaceEvent): void {
    this.events.push(event);
  }

  getEvents(playerId?: string): RaceEvent[] {
    if (!playerId) return this.events;
    return this.events.filter((e) => e.playerId === playerId);
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * Validate hazard scan (QR code)
 * Returns true if hazard is valid for current location
 */
export function validateHazardScan(
  expectedHazardId: string,
  scannedHazardId: string
): boolean {
  // TODO: Implement location-aware validation when backend provides
  // current location data
  return expectedHazardId === scannedHazardId;
}

/**
 * Determine if Helios rescue should be triggered
 * Rescue is offered if player encounters multiple hazards (3+) quickly
 */
export function shouldTriggerHeliosRescue(hazardsInWindow: number): boolean {
  return hazardsInWindow >= 3;
}

/**
 * Calculate handicap/advantage based on team performance
 * Lower-scoring teams get boosts; higher-scoring teams get penalties
 */
export function calculateTeamDynamics(playerScore: number, teamAverageScore: number): number {
  const diff = teamAverageScore - playerScore;
  // Boost weaker players to maintain team competitiveness
  return diff > 50 ? 10 : diff > 25 ? 5 : diff < -50 ? -10 : 0;
}
