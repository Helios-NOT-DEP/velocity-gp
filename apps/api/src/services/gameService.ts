import type {
  DisplayEvent,
  GetRaceStateResponse,
  HazardStatusUpdateRequest,
  HazardStatusUpdateResponse,
  LeaderboardEntry,
  ListDisplayEventsQuery,
  ListDisplayEventsResponse,
} from '@velocity-gp/api-contract';
import { prisma } from '../db/client.js';

import { createIsoDate, placeholderPlayer, placeholderTeam } from './placeholderData.js';

/**
 * Game-state service for race status and leaderboard endpoints.
 *
 * These handlers currently synthesize deterministic placeholder responses while
 * event-state persistence is being finalized.
 */
export function getRaceState(eventId: string, playerId: string): GetRaceStateResponse {
  const teamStatus = playerId === placeholderPlayer.id ? 'IN_PIT' : placeholderTeam.status;

  return {
    playerId,
    eventId,
    teamId: placeholderTeam.id,
    teamName: placeholderTeam.name,
    teamStatus,
    status: teamStatus,
    raceControlState: 'ACTIVE',
    scannerEnabled: teamStatus !== 'IN_PIT',
    pitStopExpiresAt: teamStatus === 'IN_PIT' ? createIsoDate(15) : null,
    currentLocation: 'PIT_LANE_ALPHA',
    hazardsEncountered: ['qr-alpha-01'],
    score: placeholderTeam.score,
    individualScore: placeholderPlayer.individualScore,
    updatedAt: createIsoDate(0),
  };
}

const DISPLAY_EVENT_REASON_TO_TYPE: Record<
  'HAZARD_TRIGGER' | 'TIMER_EXPIRED' | 'ADMIN_MANUAL' | 'RESCUE_CLEARED',
  DisplayEvent['type']
> = {
  HAZARD_TRIGGER: 'TEAM_ENTERED_PIT',
  TIMER_EXPIRED: 'TEAM_EXITED_PIT',
  ADMIN_MANUAL: 'TEAM_EXITED_PIT',
  RESCUE_CLEARED: 'TEAM_REPAIRS_COMPLETE',
};

const DISPLAY_EVENT_REASONS = Object.keys(DISPLAY_EVENT_REASON_TO_TYPE) as Array<
  keyof typeof DISPLAY_EVENT_REASON_TO_TYPE
>;
const DEFAULT_DISPLAY_EVENTS_LIMIT = 25;
const MAX_DISPLAY_EVENTS_LIMIT = 100;
const DISPLAY_EVENTS_CURSOR_SEPARATOR = '|';

interface DisplayEventsCursor {
  readonly occurredAt: Date;
  readonly transitionId: string | null;
}

function clampDisplayEventsLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_DISPLAY_EVENTS_LIMIT;
  }

  return Math.max(1, Math.min(MAX_DISPLAY_EVENTS_LIMIT, Math.floor(limit)));
}

function parseDisplayEventsCursor(cursor: string | undefined): DisplayEventsCursor | null {
  if (!cursor) {
    return null;
  }

  const [occurredAtToken, ...transitionIdTokens] = cursor.split(DISPLAY_EVENTS_CURSOR_SEPARATOR);
  const occurredAt = new Date(occurredAtToken);

  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  const transitionId =
    transitionIdTokens.length > 0 ? transitionIdTokens.join(DISPLAY_EVENTS_CURSOR_SEPARATOR) : null;

  return {
    occurredAt,
    transitionId: transitionId && transitionId.length > 0 ? transitionId : null,
  };
}

/**
 * Persists and returns a player's hazard status update.
 *
 * The implementation currently echoes request input with a synthetic timestamp.
 */
export function updateHazardStatus(
  eventId: string,
  playerId: string,
  request: HazardStatusUpdateRequest
): HazardStatusUpdateResponse {
  return {
    eventId,
    playerId,
    hazardId: request.hazardId,
    status: request.status,
    updatedAt: createIsoDate(5),
  };
}

/**
 * Returns the event leaderboard in rank order.
 *
 * Placeholder standings include one dynamic team name based on the provided event ID.
 */
export async function getLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
  const teams = await prisma.team.findMany({
    where: {
      eventId,
      deletedAt: null,
    },
    orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      score: true,
      status: true,
      pitStopExpiresAt: true,
      _count: {
        select: {
          players: true,
        },
      },
    },
  });

  if (teams.length === 0) {
    // Preserve placeholder behavior in empty/dev states while migration to persistent data continues.
    return [
      {
        rank: 1,
        teamId: placeholderTeam.id,
        teamName: placeholderTeam.name,
        score: placeholderTeam.score,
        memberCount: placeholderTeam.members.length,
        status: placeholderTeam.status,
        pitStopExpiresAt: placeholderTeam.pitStopExpiresAt,
      },
      {
        rank: 2,
        teamId: 'team-drift-runners',
        teamName: `${eventId}-Drift-Runners`,
        score: 1110,
        memberCount: 3,
        status: 'ACTIVE',
        pitStopExpiresAt: null,
      },
      {
        rank: 3,
        teamId: 'team-nova-thunder',
        teamName: `${eventId}-Nova-Thunder`,
        score: 920,
        memberCount: 2,
        status: 'IN_PIT',
        pitStopExpiresAt: createIsoDate(15),
      },
    ];
  }

  return teams.map((team, index) => ({
    rank: index + 1,
    teamId: team.id,
    teamName: team.name,
    score: team.score,
    memberCount: team._count.players,
    status: team.status,
    pitStopExpiresAt:
      team.status === 'IN_PIT' ? (team.pitStopExpiresAt?.toISOString() ?? null) : null,
  }));
}

export async function getDisplayEvents(
  eventId: string,
  query: ListDisplayEventsQuery
): Promise<ListDisplayEventsResponse> {
  const take = clampDisplayEventsLimit(query.limit);
  const cursor = parseDisplayEventsCursor(query.since);
  const cursorWhereClause = cursor
    ? {
        OR: [
          {
            createdAt: {
              gt: cursor.occurredAt,
            },
          },
          {
            createdAt: cursor.occurredAt,
            ...(cursor.transitionId
              ? {
                  id: {
                    gt: cursor.transitionId,
                  },
                }
              : {}),
          },
        ],
      }
    : {};

  const rows = await prisma.teamStateTransition.findMany({
    where: {
      eventId,
      reason: {
        in: DISPLAY_EVENT_REASONS,
      },
      ...cursorWhereClause,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take,
    select: {
      id: true,
      eventId: true,
      teamId: true,
      reason: true,
      createdAt: true,
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const items: DisplayEvent[] = rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    teamId: row.teamId,
    teamName: row.team.name,
    type: DISPLAY_EVENT_REASON_TO_TYPE[row.reason as keyof typeof DISPLAY_EVENT_REASON_TO_TYPE],
    reason: row.reason as DisplayEvent['reason'],
    occurredAt: row.createdAt.toISOString(),
  }));

  return {
    items,
    nextCursor:
      items.length > 0
        ? `${items[items.length - 1].occurredAt}${DISPLAY_EVENTS_CURSOR_SEPARATOR}${items[items.length - 1].id}`
        : (query.since ?? null),
  };
}
