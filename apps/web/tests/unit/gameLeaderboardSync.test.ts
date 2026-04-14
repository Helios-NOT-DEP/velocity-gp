import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchLeaderboardEntries,
  mergeTeamsWithLeaderboard,
  type SyncedTeam,
} from '@/services/game';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    get: apiGetMock,
  },
  raceStateEndpoints: {
    getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
  },
}));

describe('game leaderboard sync', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('maps leaderboard entries into GameContext team shape while preserving UI metadata', () => {
    const existingTeams: readonly SyncedTeam[] = [
      {
        id: 'team-apex',
        name: 'Apex Legacy',
        score: 500,
        rank: 3,
        inPitStop: false,
        carImage: 'https://cdn.example.com/apex.png',
        keywords: ['comet', 'neon'],
      },
      {
        id: 'team-drift',
        name: 'Drift Legacy',
        score: 470,
        rank: 4,
        inPitStop: false,
      },
    ];

    const merged = mergeTeamsWithLeaderboard(existingTeams, [
      {
        rank: 1,
        teamId: 'team-apex',
        teamName: 'Apex Comets',
        score: 1_240,
        memberCount: 4,
        status: 'ACTIVE',
      },
      {
        rank: 2,
        teamId: 'team-drift',
        teamName: 'Drift Runners',
        score: 1_110,
        memberCount: 3,
        status: 'IN_PIT',
        pitStopExpiresAt: '2030-02-01T00:00:00.000Z',
      },
    ]);

    expect(merged).toEqual([
      {
        id: 'team-apex',
        name: 'Apex Comets',
        score: 1_240,
        rank: 1,
        inPitStop: false,
        pitStopExpiresAt: undefined,
        carImage: 'https://cdn.example.com/apex.png',
        keywords: ['comet', 'neon'],
      },
      {
        id: 'team-drift',
        name: 'Drift Runners',
        score: 1_110,
        rank: 2,
        inPitStop: true,
        pitStopExpiresAt: '2030-02-01T00:00:00.000Z',
        carImage: undefined,
        keywords: undefined,
      },
    ]);
  });

  it('keeps prior pit expiry metadata when an IN_PIT entry omits pitStopExpiresAt', () => {
    const existingTeams: readonly SyncedTeam[] = [
      {
        id: 'team-apex',
        name: 'Apex Legacy',
        score: 500,
        rank: 1,
        inPitStop: true,
        pitStopExpiresAt: '2030-02-01T00:00:00.000Z',
      },
    ];

    const merged = mergeTeamsWithLeaderboard(existingTeams, [
      {
        rank: 1,
        teamId: 'team-apex',
        teamName: 'Apex Comets',
        score: 600,
        memberCount: 4,
        status: 'IN_PIT',
      },
    ]);

    expect(merged[0]?.pitStopExpiresAt).toBe('2030-02-01T00:00:00.000Z');
  });

  it('returns leaderboard entries when API returns a valid payload', async () => {
    apiGetMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: [
        {
          rank: 1,
          teamId: 'team-apex',
          teamName: 'Apex Comets',
          score: 1_000,
          memberCount: 4,
          status: 'ACTIVE',
        },
      ],
    });

    const result = await fetchLeaderboardEntries('event-1');
    expect(result).toEqual([
      {
        rank: 1,
        teamId: 'team-apex',
        teamName: 'Apex Comets',
        score: 1_000,
        memberCount: 4,
        status: 'ACTIVE',
      },
    ]);
    expect(apiGetMock).toHaveBeenCalledWith('/events/event-1/leaderboard');
  });

  it('returns null when leaderboard fetch fails or payload shape is invalid', async () => {
    apiGetMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      data: null,
    });
    apiGetMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        invalid: true,
      },
    });
    apiGetMock.mockRejectedValueOnce(new Error('network down'));

    await expect(fetchLeaderboardEntries('event-1')).resolves.toBeNull();
    await expect(fetchLeaderboardEntries('event-1')).resolves.toBeNull();
    await expect(fetchLeaderboardEntries('event-1')).resolves.toBeNull();
  });
});
