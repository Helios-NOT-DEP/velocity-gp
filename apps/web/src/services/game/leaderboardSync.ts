import type { LeaderboardEntry } from '@velocity-gp/api-contract';

import { apiClient, raceStateEndpoints } from '@/services/api';

export interface SyncedTeam {
  readonly id: string;
  readonly name: string;
  readonly carImage?: string;
  readonly score: number;
  readonly rank: number;
  readonly inPitStop: boolean;
  readonly pitStopExpiresAt?: string;
  readonly keywords?: string[];
}

export const PLAYER_LEADERBOARD_POLL_INTERVAL_MS = 5_000;

export async function fetchLeaderboardEntries(
  eventId: string
): Promise<readonly LeaderboardEntry[] | null> {
  try {
    const response = await apiClient.get<LeaderboardEntry[]>(
      raceStateEndpoints.getLeaderboard(eventId)
    );
    if (!response.ok || !Array.isArray(response.data)) {
      return null;
    }

    return response.data;
  } catch {
    return null;
  }
}

export function mergeTeamsWithLeaderboard(
  existingTeams: readonly SyncedTeam[],
  entries: readonly LeaderboardEntry[]
): SyncedTeam[] {
  const existingById = new Map(existingTeams.map((team) => [team.id, team]));

  return [...entries]
    .sort((left, right) => left.rank - right.rank || right.score - left.score)
    .map((entry) => {
      const existing = existingById.get(entry.teamId);
      const inPitStop = entry.status === 'IN_PIT';

      return {
        id: entry.teamId,
        name: entry.teamName,
        score: entry.score,
        rank: entry.rank,
        inPitStop,
        pitStopExpiresAt: inPitStop
          ? (entry.pitStopExpiresAt ?? existing?.pitStopExpiresAt)
          : undefined,
        carImage: existing?.carImage,
        keywords: existing?.keywords,
      };
    });
}
