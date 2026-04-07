// @vitest-environment happy-dom
/* global navigator */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import RaceHub from '../src/app/pages/RaceHub';
import { GameProvider } from '../src/app/context/GameContext';

const { getSessionMock, resolveScanIdentityForEmailMock, trackAnalyticsEventMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    resolveScanIdentityForEmailMock: vi.fn(),
    trackAnalyticsEventMock: vi.fn(),
  })
);

vi.mock('@/services/auth', () => ({
  getSession: getSessionMock,
}));

vi.mock('@/services/observability', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock('@/services/scan', async () => {
  const actual =
    await vi.importActual<typeof import('../src/services/scan')>('../src/services/scan');

  return {
    ...actual,
    resolveScanIdentityForEmail: resolveScanIdentityForEmailMock,
  };
});

function renderRaceHub() {
  return render(
    <GameProvider>
      <MemoryRouter>
        <RaceHub />
      </MemoryRouter>
    </GameProvider>
  );
}

const originalMediaDevices = navigator.mediaDevices;

describe('RaceHub scanner recovery states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      email: 'lina@velocitygp.dev',
    });
    resolveScanIdentityForEmailMock.mockResolvedValue({
      status: 'resolved',
      identity: {
        eventId: 'event-velocity-active',
        playerId: 'player-lina-active',
        teamId: 'team-apex-comets',
        teamName: 'Apex Comets',
        email: 'lina@velocitygp.dev',
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it('shows unsupported guidance when camera APIs are unavailable', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    renderRaceHub();

    await screen.findByRole('button', { name: /Start Camera Scan/i });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Start Camera Scan/i }).hasAttribute('disabled')
      ).toBe(false);
    });
    const startButton = screen.getByRole('button', { name: /Start Camera Scan/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Scanner Unsupported')).toBeTruthy();
      expect(screen.getByText('This browser cannot access camera scanning APIs.')).toBeTruthy();
    });
  });

  it('shows permission denied feedback when user rejects camera access', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue({
          name: 'NotAllowedError',
        }),
      },
    });

    renderRaceHub();

    await screen.findByRole('button', { name: /Start Camera Scan/i });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Start Camera Scan/i }).hasAttribute('disabled')
      ).toBe(false);
    });
    const startButton = screen.getByRole('button', { name: /Start Camera Scan/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Denied')).toBeTruthy();
      expect(
        screen.getByText('Allow camera access to continue scanning from Race Hub.')
      ).toBeTruthy();
    });
  });

  it('shows unmapped profile guidance when no seeded identity is available', async () => {
    resolveScanIdentityForEmailMock.mockResolvedValueOnce({
      status: 'unmapped',
      message: 'No assigned player profile was found for this email.',
    });

    renderRaceHub();

    await waitFor(() => {
      expect(screen.getByText('Scan Profile Unavailable')).toBeTruthy();
      expect(screen.getByText('No assigned player profile was found for this email.')).toBeTruthy();
      expect(
        screen.getByText(
          'No seeded player profile is mapped for this session email, so scanner submission is blocked.'
        )
      ).toBeTruthy();
    });
  });
});
