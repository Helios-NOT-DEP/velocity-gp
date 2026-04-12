// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminGameControl from '@/app/pages/admin/AdminGameControl';
import { getCurrentEventId } from '@/services/admin/roster';
import { getRaceControl, listAdminAudits, updateRaceControl } from '@/services/admin/control';
import { getEventHazardSettings, listHazardMultiplierRules } from '@/services/admin/qrCodes';

vi.mock('@/app/context/GameContext', () => ({
  useGame: () => ({
    gameState: {
      teams: [
        { id: 'team-1', inPitStop: false },
        { id: 'team-2', inPitStop: true },
      ],
    },
  }),
}));

vi.mock('@/services/admin/roster', () => ({
  getCurrentEventId: vi.fn(),
}));

vi.mock('@/services/admin/control', () => ({
  getRaceControl: vi.fn(),
  updateRaceControl: vi.fn(),
  listAdminAudits: vi.fn(),
}));

vi.mock('@/services/admin/qrCodes', () => ({
  getEventHazardSettings: vi.fn(),
  listHazardMultiplierRules: vi.fn(),
  createHazardMultiplierRule: vi.fn(),
  updateEventHazardSettings: vi.fn(),
  updateHazardMultiplierRule: vi.fn(),
  deleteHazardMultiplierRule: vi.fn(),
}));

describe('AdminGameControl operations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(getCurrentEventId).mockResolvedValue('event-1');
    vi.mocked(getRaceControl).mockResolvedValue({
      eventId: 'event-1',
      state: 'ACTIVE',
      updatedAt: '2026-04-07T10:00:00.000Z',
    });
    vi.mocked(getEventHazardSettings).mockResolvedValue({
      eventId: 'event-1',
      globalHazardRatio: 15,
      updatedAt: '2026-04-07T10:00:00.000Z',
    });
    vi.mocked(listHazardMultiplierRules).mockResolvedValue({
      eventId: 'event-1',
      rules: [],
    });
    vi.mocked(listAdminAudits).mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          eventId: 'event-1',
          actorUserId: 'admin-1',
          actionType: 'RACE_RESUMED',
          targetType: 'EVENT_CONFIG',
          targetId: 'event-1',
          details: {},
          createdAt: '2026-04-07T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    vi.mocked(updateRaceControl).mockResolvedValue({
      eventId: 'event-1',
      state: 'PAUSED',
      updatedAt: '2026-04-07T10:02:00.000Z',
      auditId: 'audit-2',
    });
  });

  it('loads race control + audits and toggles pause state', async () => {
    render(<AdminGameControl />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause Game' })).toBeTruthy();
      expect(screen.getByText('Race Resumed')).toBeTruthy();
    });

    vi.mocked(listAdminAudits).mockResolvedValueOnce({
      items: [
        {
          id: 'audit-2',
          eventId: 'event-1',
          actorUserId: 'admin-1',
          actionType: 'RACE_PAUSED',
          targetType: 'EVENT_CONFIG',
          targetId: 'event-1',
          details: {},
          createdAt: '2026-04-07T10:02:00.000Z',
        },
      ],
      nextCursor: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause Game' }));

    await waitFor(() => {
      expect(updateRaceControl).toHaveBeenCalledWith('event-1', { state: 'PAUSED' });
      expect(screen.getByRole('button', { name: 'Resume Game' })).toBeTruthy();
      expect(screen.getByText('Race Paused')).toBeTruthy();
      expect(
        screen.getByText('Scanning disabled for all teams while race control is paused.')
      ).toBeTruthy();
    });
  });
});
