// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import Leaderboard from '@/app/pages/Leaderboard';
import { GameProvider } from '@/app/context/GameContext';

const { getSessionMock, apiGetMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  apiGetMock: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  getSession: getSessionMock,
  AUTH_SESSION_UPDATED_EVENT: 'velocitygp.auth.session.updated',
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    get: apiGetMock,
  },
  raceStateEndpoints: {
    getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
  },
}));

function renderLeaderboard() {
  return render(
    <GameProvider>
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>
    </GameProvider>
  );
}

describe('Leaderboard authoritative score sync', () => {
  const documentPositionFollowing = 4;

  beforeEach(() => {
    vi.clearAllMocks();

    getSessionMock.mockResolvedValue({
      userId: 'player-lina-active',
      playerId: 'player-lina-active',
      eventId: 'event-velocity-active',
      teamId: 'team-apex-comets',
      teamStatus: 'ACTIVE',
      assignmentStatus: 'ASSIGNED_ACTIVE',
      capabilities: {
        admin: false,
        player: true,
        heliosMember: false,
      },
      role: 'player',
      isAuthenticated: true,
      email: 'lina@velocitygp.dev',
      displayName: 'Lina',
    });
  });

  it('renders leaderboard standings from backend and refreshes on background poll', async () => {
    let leaderboardCallCount = 0;
    apiGetMock.mockImplementation(async (endpoint: string) => {
      if (!endpoint.includes('/leaderboard')) {
        throw new Error(`Unexpected GET endpoint: ${endpoint}`);
      }

      leaderboardCallCount += 1;
      if (leaderboardCallCount === 1) {
        return {
          ok: true,
          status: 200,
          data: [
            {
              rank: 1,
              teamId: 'team-apex-comets',
              teamName: 'Apex Comets',
              score: 1240,
              memberCount: 4,
              status: 'ACTIVE',
            },
            {
              rank: 2,
              teamId: 'team-drift-runners',
              teamName: 'Drift Runners',
              score: 1100,
              memberCount: 4,
              status: 'ACTIVE',
            },
          ],
        };
      }

      return {
        ok: true,
        status: 200,
        data: [
          {
            rank: 1,
            teamId: 'team-drift-runners',
            teamName: 'Drift Runners',
            score: 1500,
            memberCount: 4,
            status: 'ACTIVE',
          },
          {
            rank: 2,
            teamId: 'team-apex-comets',
            teamName: 'Apex Comets',
            score: 1300,
            memberCount: 4,
            status: 'ACTIVE',
          },
        ],
      };
    });

    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText('Apex Comets')).toBeInTheDocument();
      expect(screen.getByText('Drift Runners')).toBeInTheDocument();
      expect(screen.getByText('1,240')).toBeInTheDocument();
      expect(screen.getByText('1,100')).toBeInTheDocument();
    });

    const initialLeader = screen.getByText('Apex Comets');
    const initialChaser = screen.getByText('Drift Runners');
    expect(
      initialLeader.compareDocumentPosition(initialChaser) & documentPositionFollowing
    ).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5_200);
      });
    });

    await waitFor(() => {
      expect(screen.getByText('1,500')).toBeInTheDocument();
      expect(screen.getByText('1,300')).toBeInTheDocument();
    });

    const refreshedLeader = screen.getByText('Drift Runners');
    const refreshedChaser = screen.getByText('Apex Comets');
    expect(
      refreshedLeader.compareDocumentPosition(refreshedChaser) & documentPositionFollowing
    ).toBeTruthy();
  }, 15_000);
});
