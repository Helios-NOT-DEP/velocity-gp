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

describe('display board route', () => {
  beforeEach(() => {
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
              id: 'event-display-1',
              name: 'Display Event',
              status: 'ACTIVE',
              startDate: '2026-04-12T00:00:00.000Z',
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

      if (/\/api\/events\/event-display-1\/leaderboard(?:\?|$)/i.test(requestUrl)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                rank: 1,
                teamId: 'team-apex',
                teamName: 'Apex Meteors',
                score: 1600,
                memberCount: 4,
                status: 'ACTIVE',
              },
              {
                rank: 2,
                teamId: 'team-risk',
                teamName: 'Risk Racers',
                score: 1450,
                memberCount: 4,
                status: 'IN_PIT',
              },
              {
                rank: 3,
                teamId: 'team-drift',
                teamName: 'Drift Unit',
                score: 1410,
                memberCount: 3,
                status: 'ACTIVE',
              },
              {
                rank: 4,
                teamId: 'team-nova',
                teamName: 'Nova Crew',
                score: 1300,
                memberCount: 4,
                status: 'ACTIVE',
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

  it('is publicly reachable and renders the display-board shell without player controls', async () => {
    renderWithRoute('/display');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Main Stage Display Board' })).toBeTruthy();
    });

    expect(screen.getByRole('region', { name: 'Top 3 Teams' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Leaderboard Grid' })).toBeTruthy();
    expect(screen.getByText('Apex Meteors')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scanner' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Email Me a Sign-In Link' })).toBeNull();
  });
});
