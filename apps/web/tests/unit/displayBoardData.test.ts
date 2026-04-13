import { describe, expect, it, vi } from 'vitest';

import type { LeaderboardEntry } from '@velocity-gp/api-contract';
import {
  getDisplayBoardRetryDelayMs,
  normalizeDisplayBoardFromContextTeams,
  partitionDisplayBoardTeams,
  resolveDisplayBoardSnapshot,
  type DisplayFallbackTeam,
  type DisplayBoardSnapshotDependencies,
} from '@/services/display';

const sampleContextTeams: readonly DisplayFallbackTeam[] = [
  {
    id: 'team-alpha',
    name: 'Team Alpha',
    score: 850,
    rank: 2,
    inPitStop: false,
    carImage: 'https://example.com/team-alpha.png',
  },
  {
    id: 'team-beta',
    name: 'Team Beta',
    score: 970,
    rank: 1,
    inPitStop: true,
    pitStopExpiresAt: '2030-06-02T10:15:00.000Z',
  },
];

describe('displayBoardData', () => {
  it('partitions standings into Top 3 and grid sections', () => {
    const normalizedTeams = normalizeDisplayBoardFromContextTeams([
      ...sampleContextTeams,
      {
        id: 'team-gamma',
        name: 'Team Gamma',
        score: 720,
        rank: 3,
        inPitStop: false,
      },
      {
        id: 'team-delta',
        name: 'Team Delta',
        score: 640,
        rank: 4,
        inPitStop: false,
      },
    ]);

    const partitioned = partitionDisplayBoardTeams(normalizedTeams);
    expect(partitioned.topThree).toHaveLength(3);
    expect(partitioned.grid).toHaveLength(1);
    expect(partitioned.topThree[0].teamName).toBe('Team Beta');
    expect(partitioned.grid[0].teamName).toBe('Team Delta');
  });

  it('prefers API standings and enriches with context metadata when available', async () => {
    const leaderboardEntries: readonly LeaderboardEntry[] = [
      {
        rank: 1,
        teamId: 'team-alpha',
        teamName: 'Team Alpha',
        score: 1_200,
        memberCount: 4,
        status: 'ACTIVE',
      },
      {
        rank: 2,
        teamId: 'team-beta',
        teamName: 'Team Beta',
        score: 1_150,
        memberCount: 3,
        status: 'IN_PIT',
      },
    ];

    const dependencies: DisplayBoardSnapshotDependencies = {
      fetchCurrentEventId: vi.fn(async () => 'event-1'),
      fetchLeaderboardEntries: vi.fn(async () => leaderboardEntries),
    };

    const snapshot = await resolveDisplayBoardSnapshot(sampleContextTeams, dependencies);
    expect(snapshot.source).toBe('api');
    expect(snapshot.eventId).toBe('event-1');
    expect(snapshot.teams[0].carImage).toBe('https://example.com/team-alpha.png');
    expect(snapshot.teams[1].pitStopExpiresAt).toBe('2030-06-02T10:15:00.000Z');
  });

  it('falls back to context standings when API data cannot be loaded', async () => {
    const dependencies: DisplayBoardSnapshotDependencies = {
      fetchCurrentEventId: vi.fn(async () => null),
      fetchLeaderboardEntries: vi.fn(async () => []),
    };

    const snapshot = await resolveDisplayBoardSnapshot(sampleContextTeams, dependencies);
    expect(snapshot.source).toBe('context');
    expect(snapshot.eventId).toBeNull();
    expect(snapshot.teams[0].teamName).toBe('Team Beta');
  });

  it('falls back to empty state when neither API nor context has standings', async () => {
    const dependencies: DisplayBoardSnapshotDependencies = {
      fetchCurrentEventId: vi.fn(async () => null),
      fetchLeaderboardEntries: vi.fn(async () => null),
    };

    const snapshot = await resolveDisplayBoardSnapshot([], dependencies);
    expect(snapshot.source).toBe('empty');
    expect(snapshot.teams).toHaveLength(0);
  });

  it('applies exponential retry delay with an upper cap', () => {
    expect(getDisplayBoardRetryDelayMs(0)).toBe(5_000);
    expect(getDisplayBoardRetryDelayMs(1)).toBe(10_000);
    expect(getDisplayBoardRetryDelayMs(3)).toBe(30_000);
    expect(getDisplayBoardRetryDelayMs(6)).toBe(30_000);
  });
});
