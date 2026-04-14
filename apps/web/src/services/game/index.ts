/**
 * Game Services
 */

export { getRaceState, calculateScore, isInPitStop, formatRaceTime } from './gameService';
export {
  RaceEventLog,
  validateHazardScan,
  shouldTriggerHeliosRescue,
  calculateTeamDynamics,
} from './raceLogic';
export {
  PLAYER_LEADERBOARD_POLL_INTERVAL_MS,
  fetchLeaderboardEntries,
  mergeTeamsWithLeaderboard,
} from './leaderboardSync';
export type { SyncedTeam } from './leaderboardSync';
