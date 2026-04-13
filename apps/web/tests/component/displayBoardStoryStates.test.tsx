// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';

import { appRoutes } from '@/app/routes';
import { GameProvider } from '@/app/context/GameContext';

function renderWithRoute(pathname: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [pathname],
  });

  return render(
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}

describe('display board storytelling states', () => {
  beforeEach(() => {
    let leaderboardCallCount = 0;
    let displayEventsCallCount = 0;

    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const requestUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (/\/api\/auth\/session(?:\?|$)/i.test(requestUrl)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'TEST_NON_AUTHORITATIVE_AUTH',
            },
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }

      if (/\/api\/events\/current(?:\?|$)/i.test(requestUrl)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'event-display-story',
              name: 'Display Story Event',
              status: 'ACTIVE',
              startDate: '2026-04-13T00:00:00.000Z',
              endDate: '2026-04-15T00:00:00.000Z',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }

      if (/\/api\/events\/event-display-story\/leaderboard(?:\?|$)/i.test(requestUrl)) {
        leaderboardCallCount += 1;

        if (leaderboardCallCount === 1) {
          return new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  rank: 1,
                  teamId: 'team-alpha',
                  teamName: 'Team Alpha',
                  score: 1500,
                  memberCount: 4,
                  status: 'ACTIVE',
                  pitStopExpiresAt: null,
                },
                {
                  rank: 2,
                  teamId: 'team-beta',
                  teamName: 'Team Beta',
                  score: 1400,
                  memberCount: 4,
                  status: 'ACTIVE',
                  pitStopExpiresAt: null,
                },
                {
                  rank: 3,
                  teamId: 'team-epsilon',
                  teamName: 'Team Epsilon',
                  score: 1325,
                  memberCount: 4,
                  status: 'ACTIVE',
                  pitStopExpiresAt: null,
                },
                {
                  rank: 4,
                  teamId: 'team-gamma',
                  teamName: 'Team Gamma',
                  score: 1300,
                  memberCount: 4,
                  status: 'ACTIVE',
                  pitStopExpiresAt: null,
                },
                {
                  rank: 5,
                  teamId: 'team-delta',
                  teamName: 'Team Delta',
                  score: 1200,
                  memberCount: 4,
                  status: 'ACTIVE',
                  pitStopExpiresAt: null,
                },
              ],
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                rank: 1,
                teamId: 'team-alpha',
                teamName: 'Team Alpha',
                score: 1500,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 2,
                teamId: 'team-beta',
                teamName: 'Team Beta',
                score: 1400,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 3,
                teamId: 'team-epsilon',
                teamName: 'Team Epsilon',
                score: 1325,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 4,
                teamId: 'team-delta',
                teamName: 'Team Delta',
                score: 1350,
                memberCount: 4,
                status: 'IN_PIT',
                pitStopExpiresAt: '2030-04-13T02:15:00.000Z',
              },
              {
                rank: 5,
                teamId: 'team-gamma',
                teamName: 'Team Gamma',
                score: 1290,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }

      if (requestUrl.includes('/display-events')) {
        displayEventsCallCount += 1;

        if (displayEventsCallCount === 1) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [],
                nextCursor: null,
              },
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  id: 'transition-1',
                  eventId: 'event-display-story',
                  teamId: 'team-delta',
                  teamName: 'Team Delta',
                  type: 'TEAM_ENTERED_PIT',
                  reason: 'HAZARD_TRIGGER',
                  occurredAt: '2030-04-13T02:00:01.000Z',
                },
                {
                  id: 'transition-2',
                  eventId: 'event-display-story',
                  teamId: 'team-delta',
                  teamName: 'Team Delta',
                  type: 'TEAM_REPAIRS_COMPLETE',
                  reason: 'RESCUE_CLEARED',
                  occurredAt: '2030-04-13T02:00:02.000Z',
                },
              ],
              nextCursor: '2030-04-13T02:00:02.000Z',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }

      return new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: {
          'content-type': 'application/json',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as typeof window.fetch;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders pit flash, repairs banner, and overtake highlight states', async () => {
    renderWithRoute('/display');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Main Stage Display Board' })).toBeTruthy();
    });

    await waitFor(
      () => {
        const overtakingRow = document.querySelector('[data-team-id="team-delta"]');
        expect(overtakingRow).toBeTruthy();
        expect(overtakingRow?.className).toContain('ring-2');
      },
      { timeout: 12_000 }
    );

    await waitFor(
      () => {
        expect(screen.getByLabelText('Pit entry alert')).toBeTruthy();
      },
      { timeout: 12_000 }
    );

    await waitFor(
      () => {
        expect(screen.getByText('REPAIRS COMPLETE')).toBeTruthy();
        expect(screen.getByText('Team Team Delta is back on track.')).toBeTruthy();
      },
      { timeout: 14_000 }
    );
  }, 20_000);
});
