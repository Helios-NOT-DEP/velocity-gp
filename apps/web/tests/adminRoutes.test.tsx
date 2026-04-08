// @vitest-environment happy-dom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { appRoutes } from '../src/app/routes';
import { AUTH_SESSION_STORAGE_KEY } from '../src/services/auth';
import type { AuthSession } from '../src/services/auth';
import { GameProvider } from '../src/app/context/GameContext';

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
  afterEach(() => {
    window.localStorage.clear();
  });

  it('redirects unauthenticated users from /admin routes to /', async () => {
    renderWithRoute('/admin/game-control');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeTruthy();
    });
  });

  it('redirects legacy /signup path to the login experience', async () => {
    renderWithRoute('/signup');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeTruthy();
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
});
