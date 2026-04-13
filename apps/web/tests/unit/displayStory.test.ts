import { describe, expect, it, vi } from 'vitest';

import { createDisplayBoardSnapshot, type DisplayBoardTeam } from '@/services/display';
import {
  dequeueNextStoryEvent,
  detectOvertakeStoryEvents,
  enqueueStoryEvents,
  fetchDisplayEvents,
  pruneExpiredStoryQueue,
} from '@/services/display';

function createSnapshot(teams: readonly DisplayBoardTeam[], fetchedAt: number) {
  const snapshot = createDisplayBoardSnapshot('api', teams, 'event-1');
  return {
    ...snapshot,
    fetchedAt,
  };
}

describe('displayStory', () => {
  it('detects rank improvements as overtake story events', () => {
    const previous = createSnapshot(
      [
        {
          rank: 1,
          teamId: 'team-alpha',
          teamName: 'Team Alpha',
          score: 1200,
          status: 'ACTIVE',
          memberCount: 4,
          pitStopExpiresAt: null,
          carImage: null,
        },
        {
          rank: 2,
          teamId: 'team-beta',
          teamName: 'Team Beta',
          score: 1190,
          status: 'ACTIVE',
          memberCount: 4,
          pitStopExpiresAt: null,
          carImage: null,
        },
      ],
      1000
    );

    const next = createSnapshot(
      [
        {
          rank: 1,
          teamId: 'team-beta',
          teamName: 'Team Beta',
          score: 1250,
          status: 'ACTIVE',
          memberCount: 4,
          pitStopExpiresAt: null,
          carImage: null,
        },
        {
          rank: 2,
          teamId: 'team-alpha',
          teamName: 'Team Alpha',
          score: 1240,
          status: 'ACTIVE',
          memberCount: 4,
          pitStopExpiresAt: null,
          carImage: null,
        },
      ],
      2000
    );

    const events = detectOvertakeStoryEvents(previous, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'OVERTAKE',
      teamId: 'team-beta',
      fromRank: 2,
      toRank: 1,
      teamName: 'Team Beta',
      passedTeamName: 'Team Alpha',
    });
  });

  it('keeps queue bounded and prunes expired events', () => {
    const nowMs = 10_000;
    const expiredEvent = {
      id: 'expired',
      type: 'OVERTAKE',
      teamId: 'team-1',
      teamName: 'Team One',
      occurredAt: '2026-04-13T01:00:00.000Z',
      ttlMs: 1000,
      expiresAtMs: 5_000,
    } as const;

    const queued = enqueueStoryEvents(
      [expiredEvent],
      [
        {
          id: 'pit-entry',
          type: 'TEAM_ENTERED_PIT',
          teamId: 'team-2',
          teamName: 'Team Two',
          occurredAt: '2026-04-13T01:00:01.000Z',
          ttlMs: 1_200,
        },
        {
          id: 'repairs',
          type: 'TEAM_REPAIRS_COMPLETE',
          teamId: 'team-2',
          teamName: 'Team Two',
          occurredAt: '2026-04-13T01:00:02.000Z',
          ttlMs: 4_000,
        },
      ],
      nowMs
    );

    expect(queued).toHaveLength(2);
    expect(pruneExpiredStoryQueue(queued, nowMs + 3_000)).toHaveLength(1);
  });

  it('dequeues next story event in occurrence order', () => {
    const queue = [
      {
        id: 'first',
        type: 'TEAM_ENTERED_PIT',
        teamId: 'team-1',
        teamName: 'Team One',
        occurredAt: '2026-04-13T01:00:00.000Z',
        ttlMs: 1200,
        expiresAtMs: 12_000,
      },
      {
        id: 'second',
        type: 'OVERTAKE',
        teamId: 'team-2',
        teamName: 'Team Two',
        occurredAt: '2026-04-13T01:00:01.000Z',
        ttlMs: 1000,
        expiresAtMs: 12_000,
      },
    ] as const;

    const { nextEvent, remainingQueue } = dequeueNextStoryEvent(queue, 10_000);
    expect(nextEvent?.id).toBe('first');
    expect(remainingQueue).toHaveLength(1);
    expect(remainingQueue[0].id).toBe('second');
  });

  it('returns null when display-events API is unavailable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network unavailable');
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDisplayEvents('event-1', null);
    expect(result).toBeNull();
  });
});
