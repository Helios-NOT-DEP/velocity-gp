import type { EventSummary, LeaderboardEntry } from '@velocity-gp/api-contract';

import { apiClient, eventEndpoints, raceStateEndpoints } from '@/services/api';

export interface DisplayFallbackTeam {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly rank: number;
  readonly inPitStop: boolean;
  readonly pitStopExpiresAt?: string;
  readonly carImage?: string;
}

export type DisplayBoardDataSource = 'api' | 'context' | 'empty';
export type DisplayBoardTeamStatus = 'PENDING' | 'ACTIVE' | 'IN_PIT';

export interface DisplayBoardTeam {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly score: number;
  readonly status: DisplayBoardTeamStatus;
  readonly memberCount: number;
  readonly pitStopExpiresAt: string | null;
  readonly carImage: string | null;
}

export interface DisplayBoardSnapshot {
  readonly source: DisplayBoardDataSource;
  readonly fetchedAt: number;
  readonly eventId: string | null;
  readonly teams: readonly DisplayBoardTeam[];
  readonly topThree: readonly DisplayBoardTeam[];
  readonly grid: readonly DisplayBoardTeam[];
}

export interface DisplayBoardSnapshotDependencies {
  readonly fetchCurrentEventId: () => Promise<string | null>;
  readonly fetchLeaderboardEntries: (
    eventId: string
  ) => Promise<readonly LeaderboardEntry[] | null>;
}

export const DISPLAY_BOARD_POLL_INTERVAL_MS = 5_000;
export const DISPLAY_BOARD_MAX_BACKOFF_MS = 30_000;
export const DISPLAY_BOARD_STALE_AFTER_MS = 15_000;
const DISPLAY_BOARD_MAX_TEAMS = 15;

function normalizeStatus(status: string): DisplayBoardTeamStatus {
  if (status === 'IN_PIT' || status === 'PENDING' || status === 'ACTIVE') {
    return status;
  }

  return 'ACTIVE';
}

function buildFallbackTeamMap(
  teams: readonly DisplayFallbackTeam[]
): Map<string, DisplayFallbackTeam> {
  return new Map(teams.map((team) => [team.id, team]));
}

export function normalizeDisplayBoardFromLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
  fallbackTeams: readonly DisplayFallbackTeam[]
): readonly DisplayBoardTeam[] {
  const fallbackByTeamId = buildFallbackTeamMap(fallbackTeams);

  return [...entries]
    .sort((left, right) => left.rank - right.rank || right.score - left.score)
    .slice(0, DISPLAY_BOARD_MAX_TEAMS)
    .map((entry) => {
      const fallbackTeam = fallbackByTeamId.get(entry.teamId);
      const status = normalizeStatus(entry.status);

      return {
        rank: entry.rank,
        teamId: entry.teamId,
        teamName: entry.teamName,
        score: entry.score,
        status,
        memberCount: entry.memberCount,
        pitStopExpiresAt:
          status === 'IN_PIT'
            ? (entry.pitStopExpiresAt ?? fallbackTeam?.pitStopExpiresAt ?? null)
            : null,
        carImage: fallbackTeam?.carImage ?? null,
      } satisfies DisplayBoardTeam;
    });
}

export function normalizeDisplayBoardFromContextTeams(
  teams: readonly DisplayFallbackTeam[]
): readonly DisplayBoardTeam[] {
  return [...teams]
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, DISPLAY_BOARD_MAX_TEAMS)
    .map((team, index) => ({
      rank: index + 1,
      teamId: team.id,
      teamName: team.name,
      score: team.score,
      status: team.inPitStop ? 'IN_PIT' : 'ACTIVE',
      memberCount: 0,
      pitStopExpiresAt: team.inPitStop ? (team.pitStopExpiresAt ?? null) : null,
      carImage: team.carImage ?? null,
    }));
}

export function partitionDisplayBoardTeams(teams: readonly DisplayBoardTeam[]) {
  const ordered = [...teams]
    .sort((left, right) => left.rank - right.rank || right.score - left.score)
    .slice(0, DISPLAY_BOARD_MAX_TEAMS);

  return {
    topThree: ordered.slice(0, 3),
    grid: ordered.slice(3),
  };
}

export function createDisplayBoardSnapshot(
  source: DisplayBoardDataSource,
  teams: readonly DisplayBoardTeam[],
  eventId: string | null
): DisplayBoardSnapshot {
  const partitioned = partitionDisplayBoardTeams(teams);

  return {
    source,
    fetchedAt: Date.now(),
    eventId,
    teams,
    topThree: partitioned.topThree,
    grid: partitioned.grid,
  };
}

async function fetchCurrentEventId(): Promise<string | null> {
  try {
    const response = await apiClient.get<EventSummary>(eventEndpoints.getCurrentEvent);
    if (!response.ok || !response.data) {
      return null;
    }

    return response.data.id;
  } catch {
    return null;
  }
}

async function fetchLeaderboardEntries(
  eventId: string
): Promise<readonly LeaderboardEntry[] | null> {
  try {
    const response = await apiClient.get<LeaderboardEntry[]>(
      raceStateEndpoints.getLeaderboard(eventId)
    );
    if (!response.ok || !response.data) {
      return null;
    }

    return response.data;
  } catch {
    return null;
  }
}

const defaultSnapshotDependencies: DisplayBoardSnapshotDependencies = {
  fetchCurrentEventId,
  fetchLeaderboardEntries,
};

export async function resolveDisplayBoardSnapshot(
  contextTeams: readonly DisplayFallbackTeam[],
  dependencies: DisplayBoardSnapshotDependencies = defaultSnapshotDependencies
): Promise<DisplayBoardSnapshot> {
  const eventId = await dependencies.fetchCurrentEventId();

  if (eventId) {
    const leaderboardEntries = await dependencies.fetchLeaderboardEntries(eventId);
    if (leaderboardEntries) {
      const teams = normalizeDisplayBoardFromLeaderboardEntries(leaderboardEntries, contextTeams);
      return createDisplayBoardSnapshot('api', teams, eventId);
    }
  }

  if (contextTeams.length > 0) {
    const teams = normalizeDisplayBoardFromContextTeams(contextTeams);
    return createDisplayBoardSnapshot('context', teams, null);
  }

  return createDisplayBoardSnapshot('empty', [], eventId);
}

export function getDisplayBoardRetryDelayMs(consecutiveFailureCount: number): number {
  const normalizedFailureCount = Math.max(0, consecutiveFailureCount);
  return Math.min(
    DISPLAY_BOARD_MAX_BACKOFF_MS,
    DISPLAY_BOARD_POLL_INTERVAL_MS * 2 ** normalizedFailureCount
  );
}
