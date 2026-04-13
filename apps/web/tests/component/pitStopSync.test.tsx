// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import PitStop from '@/app/pages/PitStop';

const { resolveScanIdentityForEmailMock, useGameMock, navigateMock } = vi.hoisted(() => ({
  resolveScanIdentityForEmailMock: vi.fn(),
  useGameMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('@/services/scan', () => ({
  resolveScanIdentityForEmail: resolveScanIdentityForEmailMock,
}));

vi.mock('@/app/context/GameContext', () => ({
  useGame: useGameMock,
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const baseTime = new Date('2026-04-13T00:00:00.000Z');

interface MockGameState {
  currentUser: {
    name: string;
    email: string;
    teamId: string;
    isHelios: boolean;
  };
  currentTeam: {
    id: string;
    name: string;
    score: number;
    rank: number;
    inPitStop: boolean;
    pitStopExpiresAt?: string;
  };
  teams: [];
  scans: [];
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

function buildIdentity(
  overrides?: Partial<{
    teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null;
    pitStopExpiresAt: string | null;
  }>
) {
  return {
    eventId: 'event-velocity-active',
    playerId: 'player-lina-active',
    teamId: 'team-apex-comets',
    teamName: 'Apex Comets',
    teamStatus: overrides?.teamStatus ?? 'IN_PIT',
    pitStopExpiresAt:
      overrides?.pitStopExpiresAt ?? new Date(baseTime.getTime() + 20_000).toISOString(),
    email: 'lina@velocitygp.dev',
  };
}

describe('PitStop backend sync behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls backend pit state, updates countdown, and exits when pit lockout is released', async () => {
    let mockGameState: MockGameState = {
      currentUser: {
        name: 'Lina',
        email: 'lina@velocitygp.dev',
        teamId: 'team-apex-comets',
        isHelios: false,
      },
      currentTeam: {
        id: 'team-apex-comets',
        name: 'Apex Comets',
        score: 420,
        rank: 1,
        inPitStop: true,
        pitStopExpiresAt: new Date(baseTime.getTime() + 20_000).toISOString(),
      },
      teams: [],
      scans: [],
    };

    const hydrateScanIdentityMock = vi.fn((identity: ReturnType<typeof buildIdentity>) => {
      mockGameState = {
        ...mockGameState,
        currentTeam: {
          ...mockGameState.currentTeam,
          inPitStop: identity.teamStatus === 'IN_PIT',
          pitStopExpiresAt: identity.pitStopExpiresAt ?? undefined,
        },
      };
    });

    const clearPitStopMock = vi.fn((teamId: string) => {
      if (mockGameState.currentTeam?.id !== teamId) {
        return;
      }

      mockGameState = {
        ...mockGameState,
        currentTeam: {
          ...mockGameState.currentTeam,
          inPitStop: false,
          pitStopExpiresAt: undefined,
        },
      };
    });

    useGameMock.mockImplementation(() => ({
      gameState: mockGameState,
      clearPitStop: clearPitStopMock,
      hydrateScanIdentity: hydrateScanIdentityMock,
    }));

    let syncCallCount = 0;
    resolveScanIdentityForEmailMock.mockImplementation(async () => {
      syncCallCount += 1;

      if (syncCallCount === 1) {
        return {
          status: 'resolved' as const,
          identity: buildIdentity({
            pitStopExpiresAt: new Date(baseTime.getTime() + 20_000).toISOString(),
          }),
        };
      }

      if (syncCallCount === 2) {
        return {
          status: 'resolved' as const,
          identity: buildIdentity({
            pitStopExpiresAt: new Date(baseTime.getTime() + 45_000).toISOString(),
          }),
        };
      }

      return {
        status: 'resolved' as const,
        identity: buildIdentity({
          teamStatus: 'ACTIVE',
          pitStopExpiresAt: null,
        }),
      };
    });

    render(
      <MemoryRouter>
        <PitStop />
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('00:20')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(screen.getByText('00:40')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(clearPitStopMock).toHaveBeenCalledWith('team-apex-comets');
    expect(navigateMock).toHaveBeenCalledWith('/race', { replace: true });
    expect(resolveScanIdentityForEmailMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('does not start a new sync request while a prior pit-state sync is still in flight', async () => {
    const mockGameState: MockGameState = {
      currentUser: {
        name: 'Lina',
        email: 'lina@velocitygp.dev',
        teamId: 'team-apex-comets',
        isHelios: false,
      },
      currentTeam: {
        id: 'team-apex-comets',
        name: 'Apex Comets',
        score: 420,
        rank: 1,
        inPitStop: true,
        pitStopExpiresAt: new Date(baseTime.getTime() + 20_000).toISOString(),
      },
      teams: [],
      scans: [],
    };

    const hydrateScanIdentityMock = vi.fn();
    const clearPitStopMock = vi.fn();

    useGameMock.mockImplementation(() => ({
      gameState: mockGameState,
      clearPitStop: clearPitStopMock,
      hydrateScanIdentity: hydrateScanIdentityMock,
    }));

    const deferredResolution = createDeferredPromise<{
      status: 'resolved';
      identity: ReturnType<typeof buildIdentity>;
    }>();

    resolveScanIdentityForEmailMock.mockImplementation(() => deferredResolution.promise);

    render(
      <MemoryRouter>
        <PitStop />
      </MemoryRouter>
    );

    expect(resolveScanIdentityForEmailMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(resolveScanIdentityForEmailMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredResolution.resolve({
        status: 'resolved',
        identity: buildIdentity(),
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(resolveScanIdentityForEmailMock).toHaveBeenCalledTimes(2);
  });
});
