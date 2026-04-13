import type { DisplayEvent, ListDisplayEventsResponse } from '@velocity-gp/api-contract';
import { apiClient, raceStateEndpoints } from '@/services/api';

import type { DisplayBoardSnapshot, DisplayBoardTeam } from './displayBoardData';

export type DisplayStoryEventType =
  | 'OVERTAKE'
  | 'TEAM_ENTERED_PIT'
  | 'TEAM_EXITED_PIT'
  | 'TEAM_REPAIRS_COMPLETE';

export interface DisplayStoryEvent {
  readonly id: string;
  readonly type: DisplayStoryEventType;
  readonly teamId: string;
  readonly teamName: string;
  readonly occurredAt: string;
  readonly ttlMs: number;
  readonly fromRank?: number;
  readonly toRank?: number;
  readonly passedTeamName?: string;
}

export interface DisplayStoryQueueItem extends DisplayStoryEvent {
  readonly expiresAtMs: number;
}

export interface DisplayEventsPollResult {
  readonly items: readonly DisplayEvent[];
  readonly nextCursor: string | null;
}

const STORY_EVENT_TTL_MS: Record<DisplayStoryEventType, number> = {
  OVERTAKE: 1_000,
  TEAM_ENTERED_PIT: 1_200,
  TEAM_EXITED_PIT: 1_000,
  TEAM_REPAIRS_COMPLETE: 4_000,
};

const DISPLAY_STORY_QUEUE_LIMIT = 24;
const DISPLAY_EVENTS_FETCH_LIMIT = 50;

function toRankMap(teams: readonly DisplayBoardTeam[]) {
  return new Map(teams.map((team) => [team.teamId, team.rank]));
}

function toTeamByRankMap(teams: readonly DisplayBoardTeam[]) {
  return new Map(teams.map((team) => [team.rank, team]));
}

function toStoryEventFromDisplayEvent(event: DisplayEvent): DisplayStoryEvent {
  return {
    id: `display:${event.id}`,
    type: event.type,
    teamId: event.teamId,
    teamName: event.teamName,
    occurredAt: event.occurredAt,
    ttlMs: STORY_EVENT_TTL_MS[event.type],
  };
}

export function detectOvertakeStoryEvents(
  previousSnapshot: DisplayBoardSnapshot | null,
  nextSnapshot: DisplayBoardSnapshot
): readonly DisplayStoryEvent[] {
  if (!previousSnapshot || previousSnapshot.teams.length === 0 || nextSnapshot.teams.length === 0) {
    return [];
  }

  const previousRankMap = toRankMap(previousSnapshot.teams);
  const previousTeamByRankMap = toTeamByRankMap(previousSnapshot.teams);

  return nextSnapshot.teams
    .filter((team) => {
      const previousRank = previousRankMap.get(team.teamId);
      return typeof previousRank === 'number' && previousRank > team.rank;
    })
    .map((team) => {
      const previousRank = previousRankMap.get(team.teamId) as number;
      const passedTeamName = previousTeamByRankMap.get(team.rank)?.teamName;
      return {
        id: `overtake:${team.teamId}:${team.rank}:${nextSnapshot.fetchedAt}`,
        type: 'OVERTAKE',
        teamId: team.teamId,
        teamName: team.teamName,
        occurredAt: new Date(nextSnapshot.fetchedAt).toISOString(),
        ttlMs: STORY_EVENT_TTL_MS.OVERTAKE,
        fromRank: previousRank,
        toRank: team.rank,
        passedTeamName,
      } satisfies DisplayStoryEvent;
    });
}

export function pruneExpiredStoryQueue(
  queue: readonly DisplayStoryQueueItem[],
  nowMs: number
): readonly DisplayStoryQueueItem[] {
  return queue.filter((item) => item.expiresAtMs > nowMs);
}

export function enqueueStoryEvents(
  queue: readonly DisplayStoryQueueItem[],
  incomingEvents: readonly DisplayStoryEvent[],
  nowMs: number
): readonly DisplayStoryQueueItem[] {
  const nextQueue = [...pruneExpiredStoryQueue(queue, nowMs)];
  const existingIds = new Set(nextQueue.map((item) => item.id));

  for (const event of incomingEvents) {
    if (existingIds.has(event.id)) {
      continue;
    }

    nextQueue.push({
      ...event,
      expiresAtMs: nowMs + event.ttlMs,
    });
    existingIds.add(event.id);
  }

  nextQueue.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  return nextQueue.slice(-DISPLAY_STORY_QUEUE_LIMIT);
}

export function dequeueNextStoryEvent(
  queue: readonly DisplayStoryQueueItem[],
  nowMs: number
): {
  readonly nextEvent: DisplayStoryQueueItem | null;
  readonly remainingQueue: readonly DisplayStoryQueueItem[];
} {
  const activeQueue = pruneExpiredStoryQueue(queue, nowMs);
  if (activeQueue.length === 0) {
    return {
      nextEvent: null,
      remainingQueue: activeQueue,
    };
  }

  const [nextEvent, ...remainingQueue] = activeQueue;
  return {
    nextEvent,
    remainingQueue,
  };
}

export async function fetchDisplayEvents(
  eventId: string,
  cursor: string | null
): Promise<DisplayEventsPollResult | null> {
  try {
    const response = await apiClient.get<ListDisplayEventsResponse>(
      raceStateEndpoints.getDisplayEvents(eventId),
      {
        since: cursor ?? undefined,
        limit: DISPLAY_EVENTS_FETCH_LIMIT,
      }
    );

    if (!response.ok || !response.data) {
      return null;
    }

    return response.data;
  } catch {
    return null;
  }
}

export function mapDisplayEventsToStoryEvents(
  events: readonly DisplayEvent[]
): readonly DisplayStoryEvent[] {
  return events.map(toStoryEventFromDisplayEvent);
}
