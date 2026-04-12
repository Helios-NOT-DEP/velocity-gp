// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { QRCodeSummary } from '@/services/api';
import AdminStatistics from '@/app/pages/admin/AdminStatistics';
import type { Scan, Team } from '@/app/context/GameContext';
import { getCurrentEventId } from '@/services/admin/roster';
import { listAdminQRCodes } from '@/services/admin/qrCodes';

const useGameMock = vi.fn();

vi.mock('@/app/context/GameContext', () => ({
  useGame: () => useGameMock(),
}));

vi.mock('@/services/admin/roster', () => ({
  getCurrentEventId: vi.fn(),
}));

vi.mock('@/services/admin/qrCodes', () => ({
  listAdminQRCodes: vi.fn(),
}));

function buildTeam(
  id: string,
  name: string,
  score: number,
  options: {
    inPitStop?: boolean;
  } = {}
): Team {
  return {
    id,
    name,
    score,
    rank: 0,
    inPitStop: options.inPitStop ?? false,
  };
}

function buildScan(id: string): Scan {
  return {
    id,
    points: 100,
    timestamp: new Date('2026-04-12T11:30:00.000Z'),
    outcome: 'SAFE',
    payload: `payload-${id}`,
    message: 'ok',
  };
}

function setGameState(teams: Team[], scans: Scan[]) {
  useGameMock.mockReturnValue({
    gameState: {
      currentUser: null,
      teams,
      currentTeam: null,
      scans,
    },
  });
}

function buildQrCode(
  id: string,
  label: string,
  options: {
    status?: 'ACTIVE' | 'DISABLED';
    scanCount?: number;
    value?: number;
    activationStartsAt?: string | null;
    activationEndsAt?: string | null;
  } = {}
): QRCodeSummary {
  return {
    id,
    eventId: 'event-1',
    label,
    value: options.value ?? 100,
    zone: null,
    payload: `payload-${id}`,
    qrImageUrl: null,
    status: options.status ?? 'ACTIVE',
    scanCount: options.scanCount ?? 0,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
    activationStartsAt: options.activationStartsAt ?? null,
    activationEndsAt: options.activationEndsAt ?? null,
  };
}

function offsetIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

describe('AdminStatistics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    setGameState([], []);
    vi.mocked(getCurrentEventId).mockResolvedValue('event-1');
    vi.mocked(listAdminQRCodes).mockResolvedValue({
      eventId: 'event-1',
      qrCodes: [],
    });
  });

  it('renders totals, top teams, and active QR rows from live/admin-derived data', async () => {
    setGameState(
      [
        buildTeam('team-1', 'Falcon Crew', 980),
        buildTeam('team-2', 'Comet Racing', 1120, { inPitStop: true }),
        buildTeam('team-3', 'Nova Squad', 1045),
        buildTeam('team-4', 'Orbit Team', 760, { inPitStop: true }),
      ],
      [buildScan('scan-1'), buildScan('scan-2'), buildScan('scan-3'), buildScan('scan-4')]
    );

    vi.mocked(listAdminQRCodes).mockResolvedValue({
      eventId: 'event-1',
      qrCodes: [
        buildQrCode('qr-alpha', 'Checkpoint Alpha', {
          scanCount: 12,
          value: 100,
          activationStartsAt: offsetIso(-60),
          activationEndsAt: offsetIso(240),
        }),
        buildQrCode('qr-bridge', 'Bridge Sprint', {
          scanCount: 7,
          value: 150,
          activationStartsAt: offsetIso(-30),
          activationEndsAt: null,
        }),
      ],
    });

    render(<AdminStatistics />);

    await waitFor(() => {
      expect(screen.getByText('Checkpoint Alpha')).toBeTruthy();
      expect(screen.getByText('Bridge Sprint')).toBeTruthy();
    });

    const teamsCard = screen.getByText('Total Teams').closest('article');
    const scansCard = screen.getByText('Total Scans').closest('article');
    const penaltiesCard = screen.getByText('Active Penalties').closest('article');
    const pointsCard = screen.getByText('Total Points Scored').closest('article');

    expect(teamsCard).toBeTruthy();
    expect(scansCard).toBeTruthy();
    expect(pointsCard).toBeTruthy();
    expect(penaltiesCard).toBeTruthy();
    expect(within(teamsCard!).getByText('4')).toBeTruthy();
    expect(within(scansCard!).getByText('4')).toBeTruthy();
    expect(within(pointsCard!).getByText('3,905')).toBeTruthy();
    expect(within(penaltiesCard!).getByText('2')).toBeTruthy();
    expect(screen.queryByText('No scans yet.')).toBeNull();

    expect(screen.getByText('Comet Racing')).toBeTruthy();
    expect(screen.getByText('Nova Squad')).toBeTruthy();
    expect(screen.getByText('Falcon Crew')).toBeTruthy();
    expect(screen.queryByText('Orbit Team')).toBeNull();

    expect(screen.getByText('12 scans')).toBeTruthy();
    expect(screen.getByText('7 scans')).toBeTruthy();
    expect(screen.getByText('+100')).toBeTruthy();
    expect(screen.getByText('+150')).toBeTruthy();
  });

  it('renders explicit empty states for teams, scans, and active QR inventory', async () => {
    setGameState([], []);
    vi.mocked(listAdminQRCodes).mockResolvedValue({
      eventId: 'event-1',
      qrCodes: [],
    });

    render(<AdminStatistics />);

    await waitFor(() => {
      expect(screen.queryByText('Loading active QR codes...')).toBeNull();
    });

    expect(screen.getByText('No teams have joined the event yet.')).toBeTruthy();
    expect(screen.getByText('No scans yet.')).toBeTruthy();
    expect(screen.getByText('No QR codes are currently active.')).toBeTruthy();
  });

  it('handles partial top-team datasets when fewer than three teams exist', async () => {
    setGameState(
      [buildTeam('team-1', 'Alpha Team', 600), buildTeam('team-2', 'Beta Team', 450)],
      [buildScan('scan-1')]
    );
    vi.mocked(listAdminQRCodes).mockResolvedValue({
      eventId: 'event-1',
      qrCodes: [],
    });

    render(<AdminStatistics />);

    await waitFor(() => {
      expect(screen.getByText('Only 2 teams currently in standings.')).toBeTruthy();
    });

    expect(screen.getByText('Alpha Team')).toBeTruthy();
    expect(screen.getByText('Beta Team')).toBeTruthy();
    expect(screen.queryByText('No teams have joined the event yet.')).toBeNull();
  });

  it('includes only currently scan-eligible ACTIVE QR codes in the active list', async () => {
    setGameState([], []);
    vi.mocked(listAdminQRCodes).mockResolvedValue({
      eventId: 'event-1',
      qrCodes: [
        buildQrCode('qr-live', 'Live Now', {
          status: 'ACTIVE',
          activationStartsAt: offsetIso(-60),
          activationEndsAt: offsetIso(60),
        }),
        buildQrCode('qr-future', 'Future Start', {
          status: 'ACTIVE',
          activationStartsAt: offsetIso(30),
          activationEndsAt: offsetIso(90),
        }),
        buildQrCode('qr-expired', 'Expired Code', {
          status: 'ACTIVE',
          activationStartsAt: offsetIso(-120),
          activationEndsAt: offsetIso(-30),
        }),
        buildQrCode('qr-disabled', 'Disabled Code', {
          status: 'DISABLED',
          activationStartsAt: offsetIso(-60),
          activationEndsAt: offsetIso(60),
        }),
      ],
    });

    render(<AdminStatistics />);

    await waitFor(() => {
      expect(screen.getByText('Live Now')).toBeTruthy();
    });

    expect(screen.queryByText('Future Start')).toBeNull();
    expect(screen.queryByText('Expired Code')).toBeNull();
    expect(screen.queryByText('Disabled Code')).toBeNull();
  });
});
