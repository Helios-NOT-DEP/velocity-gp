// @vitest-environment happy-dom

import React from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import HeliosProfile from '@/app/pages/HeliosProfile';
import { AUTH_SESSION_STORAGE_KEY } from '@/services/auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/app/context/GameContext', () => ({
  useGame: vi.fn(),
}));

import { useGame } from '@/app/context/GameContext';

const mockUseGame = vi.mocked(useGame);

const rescueLogPayload = {
  rescues: [],
};

function buildJsonApiResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: status < 400,
      data: status < 400 ? data : undefined,
      error: status >= 400 ? data : undefined,
    }),
    { status, headers: { 'content-type': 'application/json' } }
  );
}

const heliosSession = {
  userId: 'helios-user-1',
  role: 'helios' as const,
  isAuthenticated: true,
  email: 'helios@example.com',
};

const heliosGameState = {
  currentUser: {
    name: 'Helios Creator',
    email: 'helios@example.com',
    teamId: 'team-1',
    isHelios: true,
    playerId: 'player-helios-1',
    eventId: 'event-1',
  },
  teams: [{ id: 'team-1', name: 'Speed Demons', score: 0, rank: 1, inPitStop: false }],
  currentTeam: null,
  scans: [],
};

const nonHeliosGameState = {
  currentUser: {
    name: 'Regular Player',
    email: 'player@example.com',
    teamId: 'team-1',
    isHelios: false,
    playerId: 'player-regular-1',
    eventId: 'event-1',
  },
  teams: [],
  currentTeam: null,
  scans: [],
};

describe('HeliosProfile', () => {
  beforeEach(() => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(heliosSession));
    vi.restoreAllMocks();
  });

  it('redirects non-Helios users to /race', () => {
    mockUseGame.mockReturnValue({
      gameState: nonHeliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    // Navigate is triggered; the page body is not rendered.
    expect(screen.queryByText('Rescue QR Code')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated visitors to /', () => {
    mockUseGame.mockReturnValue({
      gameState: { currentUser: null, teams: [], currentTeam: null, scans: [] },
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    expect(screen.queryByText('Rescue QR Code')).not.toBeInTheDocument();
  });

  it('shows loading state while fetching the QR asset', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse(rescueLogPayload));
      }

      return new Promise(() => {
        // Never resolves — keeps the QR fetch in loading state.
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    // Loader spinner should be visible while the QR fetch is in flight.
    expect(screen.getByLabelText('Loading QR code')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Superpower QR/i })).not.toBeInTheDocument();
  });

  it('renders the QR image when the fetch succeeds', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse(rescueLogPayload));
      }

      return Promise.resolve(
        buildJsonApiResponse({
          asset: {
            id: 'qr-asset-1',
            userId: 'helios-user-1',
            payload: 'VG-SP-TESTPAYLOAD',
            qrImageUrl: 'https://cdn.velocitygp.app/qr/superpower-test.png',
            status: 'ACTIVE',
            createdAt: '2026-04-12T00:00:00.000Z',
            regeneratedAt: null,
          },
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    const qrImage = await screen.findByRole('img', { name: /Superpower QR/i });
    expect(qrImage).toBeInTheDocument();
    expect(qrImage).toHaveAttribute('src', 'https://cdn.velocitygp.app/qr/superpower-test.png');
    expect(screen.queryByLabelText('Loading QR code')).not.toBeInTheDocument();
  });

  it('shows an error banner when the QR fetch fails', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse(rescueLogPayload));
      }

      return Promise.resolve(buildJsonApiResponse({ message: 'Server error' }, 500));
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your Superpower QR. Please try again.'
    );
  });

  it('regenerates the QR when the Regenerate button is clicked', async () => {
    let hasReturnedInitialQr = false;
    const qrFetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse(rescueLogPayload));
      }

      if (url.includes('/regenerate')) {
        return Promise.resolve(
          buildJsonApiResponse({
            asset: {
              id: 'qr-asset-2',
              userId: 'helios-user-1',
              payload: 'VG-SP-REGEN',
              qrImageUrl: 'https://cdn.velocitygp.app/qr/regenerated.png',
              status: 'ACTIVE',
              createdAt: '2026-04-12T01:00:00.000Z',
              regeneratedAt: '2026-04-12T01:00:00.000Z',
            },
            revokedAssetId: 'qr-asset-1',
          })
        );
      }

      if (!hasReturnedInitialQr) {
        hasReturnedInitialQr = true;
        return Promise.resolve(
          buildJsonApiResponse({
            asset: {
              id: 'qr-asset-1',
              userId: 'helios-user-1',
              payload: 'VG-SP-ORIGINAL',
              qrImageUrl: 'https://cdn.velocitygp.app/qr/original.png',
              status: 'ACTIVE',
              createdAt: '2026-04-12T00:00:00.000Z',
              regeneratedAt: null,
            },
          })
        );
      }

      return Promise.resolve(buildJsonApiResponse({ message: 'Unexpected call' }, 500));
    });
    vi.stubGlobal('fetch', qrFetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    // Wait for the initial QR to load.
    const initialQr = await screen.findByRole('img', { name: /Superpower QR/i });
    expect(initialQr).toHaveAttribute('src', 'https://cdn.velocitygp.app/qr/original.png');

    // Click the regenerate button.
    const regenerateButton = screen.getByRole('button', {
      name: /Regenerate Superpower QR/i,
    });
    fireEvent.click(regenerateButton);

    // After regeneration, the new QR URL should be shown.
    await waitFor(() => {
      const updatedQr = screen.getByRole('img', { name: /Superpower QR/i });
      expect(updatedQr).toHaveAttribute('src', 'https://cdn.velocitygp.app/qr/regenerated.png');
    });
  });

  it('disables the regenerate button while regeneration is in flight', async () => {
    let resolveRegen: (value: Response) => void;
    const regenPromise = new Promise<Response>((resolve) => {
      resolveRegen = resolve;
    });

    let hasReturnedInitialQr = false;
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse(rescueLogPayload));
      }

      if (url.includes('/regenerate')) {
        return regenPromise;
      }

      if (!hasReturnedInitialQr) {
        hasReturnedInitialQr = true;
        return Promise.resolve(
          buildJsonApiResponse({
            asset: {
              id: 'qr-asset-1',
              userId: 'helios-user-1',
              payload: 'VG-SP-ORIGINAL',
              qrImageUrl: 'https://cdn.velocitygp.app/qr/original.png',
              status: 'ACTIVE',
              createdAt: '2026-04-12T00:00:00.000Z',
              regeneratedAt: null,
            },
          })
        );
      }

      return Promise.resolve(buildJsonApiResponse({ message: 'Unexpected call' }, 500));
    });

    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    await screen.findByRole('img', { name: /Superpower QR/i });

    const regenerateButton = screen.getByRole('button', { name: /Regenerate Superpower QR/i });
    fireEvent.click(regenerateButton);

    // Button should be disabled while regeneration is pending.
    await waitFor(() => {
      expect(regenerateButton).toBeDisabled();
    });

    // Resolve the regen promise to clean up and flush state updates.
    await act(async () => {
      resolveRegen!(
        buildJsonApiResponse({
          asset: {
            id: 'qr-asset-2',
            userId: 'helios-user-1',
            payload: 'VG-SP-REGEN',
            qrImageUrl: 'https://cdn.velocitygp.app/qr/regenerated.png',
            status: 'ACTIVE',
            createdAt: '2026-04-12T01:00:00.000Z',
            regeneratedAt: '2026-04-12T01:00:00.000Z',
          },
          revokedAssetId: 'qr-asset-1',
        })
      );
      await regenPromise;
    });

    await waitFor(() => {
      expect(regenerateButton).toBeEnabled();
    });
  });

  it('renders rescue log empty state when no rescue entries exist', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse({ rescues: [] }));
      }

      return Promise.resolve(
        buildJsonApiResponse({
          asset: {
            id: 'qr-asset-1',
            userId: 'helios-user-1',
            payload: 'VG-SP-TESTPAYLOAD',
            qrImageUrl: 'https://cdn.velocitygp.app/qr/superpower-test.png',
            status: 'ACTIVE',
            createdAt: '2026-04-12T00:00:00.000Z',
            regeneratedAt: null,
          },
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    await screen.findByRole('img', { name: /Superpower QR/i });
    expect(await screen.findByText('No rescues logged yet.')).toBeInTheDocument();
  });

  it('renders rescue log entries in the activity log section', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(
          buildJsonApiResponse({
            rescues: [
              {
                id: 'rescue-2',
                playerId: 'player-2',
                eventId: 'event-1',
                rescuerUserId: 'helios-user-1',
                initiatedAt: '2026-04-12T01:00:00.000Z',
                completedAt: '2026-04-12T01:01:00.000Z',
                cooldownExpiresAt: '2026-04-12T01:04:00.000Z',
                status: 'COMPLETED',
                reason: null,
              },
              {
                id: 'rescue-1',
                playerId: 'player-1',
                eventId: 'event-1',
                rescuerUserId: 'helios-user-1',
                initiatedAt: '2026-04-12T00:30:00.000Z',
                completedAt: null,
                cooldownExpiresAt: '2026-04-12T00:33:00.000Z',
                status: 'REQUESTED',
                reason: null,
              },
            ],
          })
        );
      }

      return Promise.resolve(
        buildJsonApiResponse({
          asset: {
            id: 'qr-asset-1',
            userId: 'helios-user-1',
            payload: 'VG-SP-TESTPAYLOAD',
            qrImageUrl: 'https://cdn.velocitygp.app/qr/superpower-test.png',
            status: 'ACTIVE',
            createdAt: '2026-04-12T00:00:00.000Z',
            regeneratedAt: null,
          },
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    await screen.findByRole('img', { name: /Superpower QR/i });
    expect(await screen.findByRole('log', { name: /Recent rescue activity/i })).toBeInTheDocument();
    expect(screen.getByText('Player player-2')).toBeInTheDocument();
    expect(screen.getByText('Player player-1')).toBeInTheDocument();
  });

  it('renders rescue log error state when rescue activity fetch fails', async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/rescue/log')) {
        return Promise.resolve(buildJsonApiResponse({ message: 'Server error' }, 500));
      }

      return Promise.resolve(
        buildJsonApiResponse({
          asset: {
            id: 'qr-asset-1',
            userId: 'helios-user-1',
            payload: 'VG-SP-TESTPAYLOAD',
            qrImageUrl: 'https://cdn.velocitygp.app/qr/superpower-test.png',
            status: 'ACTIVE',
            createdAt: '2026-04-12T00:00:00.000Z',
            regeneratedAt: null,
          },
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGame.mockReturnValue({
      gameState: heliosGameState,
      login: vi.fn(),
      becomeHelios: vi.fn(),
      createTeam: vi.fn(),
      addScan: vi.fn(),
      triggerPitStop: vi.fn(),
      clearPitStop: vi.fn(),
      hydrateScanIdentity: vi.fn(),
      applyScanOutcome: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/helios']}>
        <HeliosProfile />
      </MemoryRouter>
    );

    await screen.findByRole('img', { name: /Superpower QR/i });
    expect(
      await screen.findByText('Could not load rescue activity. Please try again.')
    ).toBeInTheDocument();
  });
});
