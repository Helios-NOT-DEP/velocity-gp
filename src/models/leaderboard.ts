/**
 * Leaderboard Domain Models
 *
 * Types for leaderboard, rankings, and player statistics.
 *
 * @module models/leaderboard
 */

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  score: number;
  hazardsEncountered: number;
  raceTime?: number; // milliseconds
  status: 'IN_PIT' | 'RACING' | 'FINISHED';
}

export interface TeamLeaderboard {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  memberCount: number;
  averageScore: number;
}

export interface PlayerStats {
  playerId: string;
  totalRaces: number;
  bestScore: number;
  averageScore: number;
  hazardsEncountered: number;
  rescuesUsed: number;
  winCount: number;
}
