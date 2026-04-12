// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { appRoutes } from '@/app/routes';
import { GameProvider } from '@/app/context/GameContext';

const { requestMagicLinkMock } = vi.hoisted(() => ({
  requestMagicLinkMock: vi.fn(),
}));

vi.mock('@/services/auth', async () => {
  const actual = await vi.importActual<typeof import('@/services/auth')>('@/services/auth');

  return {
    ...actual,
    requestMagicLink: requestMagicLinkMock,
  };
});

function renderLoginRoute() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/'],
  });

  return render(
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}

describe('login magic link request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests a magic link for hello@velocitygp.app from the login UI', async () => {
    requestMagicLinkMock.mockResolvedValue({
      message: 'Check your inbox for your secure sign-in link.',
    });

    renderLoginRoute();

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'hello@velocitygp.app' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Sign-In Link' }));

    await waitFor(() => {
      expect(requestMagicLinkMock).toHaveBeenCalledWith('hello@velocitygp.app');
    });

    await waitFor(() => {
      expect(screen.getByText('Check your inbox for your secure sign-in link.')).toBeTruthy();
    });
  });

  it('shows a specific message when no user matches the work email', async () => {
    requestMagicLinkMock.mockRejectedValue(new Error('AUTH_USER_NOT_FOUND'));

    renderLoginRoute();

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'unknown@velocitygp.app' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Sign-In Link' }));

    await waitFor(() => {
      expect(requestMagicLinkMock).toHaveBeenCalledWith('unknown@velocitygp.app');
    });

    await waitFor(() => {
      expect(screen.getByText('No user found for this work email.')).toBeTruthy();
    });
  });
});
