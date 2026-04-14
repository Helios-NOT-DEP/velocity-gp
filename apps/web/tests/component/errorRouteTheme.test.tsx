// @vitest-environment happy-dom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render, screen } from '@testing-library/react';

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

describe('themed route error surface', () => {
  it('renders themed not-found experience for unknown routes', async () => {
    renderWithRoute('/totally-unknown-route');

    expect(await screen.findByText('Velocity GP Error')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '404 · Track Not Found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Login' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeTruthy();
  });
});
