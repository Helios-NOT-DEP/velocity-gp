// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { appRoutes } from '@/app/routes';
import { AUTH_SESSION_STORAGE_KEY } from '@/services/auth';
import type { AuthSession } from '@/services/auth';
import { GameProvider } from '@/app/context/GameContext';

function renderWithRoute(pathname: string, session?: AuthSession) {
  window.localStorage.clear();
  if (session) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [pathname],
  });

  return render(
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}

describe('admin route guards', () => {
  beforeEach(() => {
    const upstreamFetch = globalThis.fetch;
    const authSessionFallbackFetch = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (/\/api\/auth\/session(?:\?|$)/i.test(requestUrl)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'TEST_NON_AUTHORITATIVE_AUTH',
                message:
                  'Simulated non-authoritative auth/session transport failure for route-guard tests.',
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

        return upstreamFetch(input, init);
      }
    );

    vi.stubGlobal('fetch', authSessionFallbackFetch);
    window.fetch = authSessionFallbackFetch as typeof window.fetch;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('redirects unauthenticated users from /admin routes to /', async () => {
    renderWithRoute('/admin/game-control');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeTruthy();
    });
  });

  it('redirects unauthenticated users from /team-setup to /', async () => {
    renderWithRoute('/team-setup');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeTruthy();
    });
  });

  it('allows authenticated users to access /team-setup', async () => {
    renderWithRoute('/team-setup', {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome to the Garage' })).toBeTruthy();
    });
  });

  it('allows public access to leaderboard without authentication', async () => {
    renderWithRoute('/leaderboard');

    await waitFor(() => {
      expect(screen.getByText(/VELOCITY GRAND PRIX/i)).toBeTruthy();
    });
  });

  it('shows Helios bottom-nav button for Helios members on leaderboard', async () => {
    renderWithRoute('/leaderboard', {
      userId: 'helios-player-1',
      role: 'helios',
      isAuthenticated: true,
      email: 'helios@example.com',
      capabilities: {
        admin: false,
        player: true,
        heliosMember: true,
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Helios' })).toBeTruthy();
    });
  });

  it('hides Helios bottom-nav button for non-Helios players on leaderboard', async () => {
    renderWithRoute('/leaderboard', {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
      capabilities: {
        admin: false,
        player: true,
        heliosMember: false,
      },
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Helios' })).toBeNull();
    });
  });

  it('redirects legacy /signup path to the login experience', async () => {
    renderWithRoute('/signup');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeTruthy();
    });
  });

  it('redirects legacy /garage alias to canonical /team-setup', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: 'player-1',
        role: 'player',
        isAuthenticated: true,
        email: 'player@example.com',
      } satisfies AuthSession)
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/garage'],
    });

    render(
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome to the Garage' })).toBeTruthy();
      expect(router.state.location.pathname).toBe('/team-setup');
    });
  });

  it('shows forbidden state for authenticated non-admin users', async () => {
    renderWithRoute('/admin/game-control', {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await waitFor(() => {
      expect(screen.getByText('Admin Access Required')).toBeTruthy();
    });
  });

  it('allows admins to access protected routes and section placeholders', async () => {
    renderWithRoute('/admin/players', {
      userId: 'admin-1',
      role: 'admin',
      isAuthenticated: true,
      email: 'admin@example.com',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy();
    });
    expect(screen.getByText('Roster Filters')).toBeTruthy();
  });

  it('keeps deep links active in section navigation', async () => {
    renderWithRoute('/admin/qr-codes', {
      userId: 'admin-1',
      role: 'admin',
      isAuthenticated: true,
      email: 'admin@example.com',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'QR Codes' })).toBeTruthy();
    });

    const activeLink = screen.getAllByRole('link', { name: 'QR Codes' })[0];
    expect(activeLink.getAttribute('aria-current')).toBe('page');
  });

  it('supports admin team detail deep links', async () => {
    renderWithRoute('/admin/teams/team-123', {
      userId: 'admin-1',
      role: 'admin',
      isAuthenticated: true,
      email: 'admin@example.com',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back to Teams' })).toBeTruthy();
    });

    const activeLink = screen.getAllByRole('link', { name: 'Teams' })[0];
    expect(activeLink.getAttribute('aria-current')).toBe('page');
  });

  it('supports admin player detail deep links', async () => {
    renderWithRoute('/admin/players/player-123', {
      userId: 'admin-1',
      role: 'admin',
      isAuthenticated: true,
      email: 'admin@example.com',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back to Players' })).toBeTruthy();
    });

    const activeLink = screen.getAllByRole('link', { name: 'Players' })[0];
    expect(activeLink.getAttribute('aria-current')).toBe('page');
  });
});
