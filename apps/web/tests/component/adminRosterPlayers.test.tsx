// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AdminPlayers from '@/app/pages/admin/AdminPlayers';
import { AUTH_SESSION_STORAGE_KEY, type AuthSession } from '@/services/auth';

function buildJsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

const adminSession: AuthSession = {
  userId: 'admin-1',
  role: 'admin',
  isAuthenticated: true,
  email: 'admin@example.com',
};

function renderAdminPlayers() {
  return render(
    <MemoryRouter>
      <AdminPlayers />
    </MemoryRouter>
  );
}

describe('AdminPlayers roster workflows', () => {
  beforeEach(() => {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
    vi.restoreAllMocks();
  });

  it('renders roster rows and persists assignment updates', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as typeof window.fetch;

    fetchMock
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            id: 'event-1',
            name: 'Velocity GP Finals',
            startDate: '2026-04-07T10:00:00.000Z',
            endDate: '2026-04-07T18:00:00.000Z',
            status: 'ACTIVE',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                eventId: 'event-1',
                workEmail: 'player1@velocitygp.dev',
                displayName: 'Player One',
                isHelios: false,
                phoneE164: null,
                teamId: null,
                teamName: null,
                teamStatus: null,
                assignmentStatus: 'UNASSIGNED',
                joinedAt: '2026-04-07T10:00:00.000Z',
                updatedAt: '2026-04-07T10:00:00.000Z',
              },
            ],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            teams: [
              {
                teamId: 'team-1',
                teamName: 'Apex',
                teamStatus: 'ACTIVE',
                memberCount: 1,
              },
              {
                teamId: 'team-2',
                teamName: 'Nova',
                teamStatus: 'PENDING',
                memberCount: 0,
              },
            ],
            unassignedCount: 1,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            playerId: 'player-1',
            eventId: 'event-1',
            previousTeamId: null,
            previousTeamName: null,
            previousTeamStatus: null,
            teamId: 'team-2',
            teamName: 'Nova',
            teamStatus: 'PENDING',
            assignmentStatus: 'ASSIGNED_PENDING',
            updatedAt: '2026-04-07T10:05:00.000Z',
            auditId: 'audit-1',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                eventId: 'event-1',
                workEmail: 'player1@velocitygp.dev',
                displayName: 'Player One',
                isHelios: false,
                phoneE164: null,
                teamId: 'team-2',
                teamName: 'Nova',
                teamStatus: 'PENDING',
                assignmentStatus: 'ASSIGNED_PENDING',
                joinedAt: '2026-04-07T10:00:00.000Z',
                updatedAt: '2026-04-07T10:05:00.000Z',
              },
            ],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            teams: [
              {
                teamId: 'team-1',
                teamName: 'Apex',
                teamStatus: 'ACTIVE',
                memberCount: 1,
              },
              {
                teamId: 'team-2',
                teamName: 'Nova',
                teamStatus: 'PENDING',
                memberCount: 1,
              },
            ],
            unassignedCount: 0,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
      );

    renderAdminPlayers();

    await waitFor(() => {
      expect(screen.getByText('Player One')).toBeTruthy();
    });

    const select = screen.getByLabelText('Assign team for Player One');
    fireEvent.change(select, { target: { value: 'team-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });

    const [assignmentCallUrl, assignmentCallOptions] = fetchMock.mock.calls[4] as [
      string,
      RequestInit,
    ];
    expect(assignmentCallUrl).toContain('/admin/events/event-1/roster/players/player-1/assignment');
    expect((assignmentCallOptions.headers as Record<string, string>)['x-user-id']).toBe('admin-1');
    expect((assignmentCallOptions.headers as Record<string, string>)['x-user-role']).toBe('admin');
    expect(JSON.parse(String(assignmentCallOptions.body))).toEqual({ teamId: 'team-2' });
  });

  it('assigns and revokes Helios role from roster rows', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as typeof window.fetch;

    fetchMock
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            id: 'event-1',
            name: 'Velocity GP Finals',
            startDate: '2026-04-07T10:00:00.000Z',
            endDate: '2026-04-07T18:00:00.000Z',
            status: 'ACTIVE',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                eventId: 'event-1',
                workEmail: 'player1@velocitygp.dev',
                displayName: 'Player One',
                isHelios: false,
                phoneE164: null,
                teamId: null,
                teamName: null,
                teamStatus: null,
                assignmentStatus: 'UNASSIGNED',
                joinedAt: '2026-04-07T10:00:00.000Z',
                updatedAt: '2026-04-07T10:00:00.000Z',
              },
            ],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            teams: [],
            unassignedCount: 1,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            userId: 'user-1',
            isHelios: true,
            updatedAt: '2026-04-07T10:05:00.000Z',
            auditId: 'audit-helios-assigned',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                eventId: 'event-1',
                workEmail: 'player1@velocitygp.dev',
                displayName: 'Player One',
                isHelios: true,
                phoneE164: null,
                teamId: null,
                teamName: null,
                teamStatus: null,
                assignmentStatus: 'UNASSIGNED',
                joinedAt: '2026-04-07T10:00:00.000Z',
                updatedAt: '2026-04-07T10:05:00.000Z',
              },
            ],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            teams: [],
            unassignedCount: 1,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                id: 'audit-helios-assigned',
                eventId: 'event-1',
                actorUserId: 'admin-1',
                actionType: 'HELIOS_ASSIGNED',
                targetType: 'USER',
                targetId: 'user-1',
                details: {},
                createdAt: '2026-04-07T10:05:00.000Z',
              },
            ],
            nextCursor: null,
          },
        })
      );

    renderAdminPlayers();

    await waitFor(() => {
      expect(screen.getByText('Player One')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(8);
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeTruthy();
    });

    const [heliosCallUrl, heliosCallOptions] = fetchMock.mock.calls[4] as [string, RequestInit];
    expect(heliosCallUrl).toContain('/admin/users/user-1/helios-role');
    expect(heliosCallOptions.method).toBe('POST');
    expect(JSON.parse(String(heliosCallOptions.body))).toEqual({ isHelios: true });
  });

  it('parses CSV upload and renders preview validation rows', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as typeof window.fetch;

    fetchMock
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            id: 'event-1',
            name: 'Velocity GP Finals',
            startDate: '2026-04-07T10:00:00.000Z',
            endDate: '2026-04-07T18:00:00.000Z',
            status: 'ACTIVE',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            teams: [],
            unassignedCount: 0,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            rows: [
              {
                rowNumber: 1,
                workEmail: 'dupe@velocitygp.dev',
                normalizedWorkEmail: 'dupe@velocitygp.dev',
                displayName: 'Dupe',
                phoneE164: null,
                teamName: null,
                action: 'invalid',
                isValid: false,
                errors: ['Duplicate workEmail in import payload.'],
              },
              {
                rowNumber: 2,
                workEmail: 'valid@velocitygp.dev',
                normalizedWorkEmail: 'valid@velocitygp.dev',
                displayName: 'Valid',
                phoneE164: '+15551234567',
                teamName: 'Apex',
                action: 'create',
                isValid: true,
                errors: [],
              },
            ],
            summary: {
              total: 2,
              valid: 1,
              invalid: 1,
              create: 1,
              update: 0,
              assign: 0,
              reassign: 0,
              unchanged: 0,
            },
          },
        })
      );

    renderAdminPlayers();

    await waitFor(() => {
      expect(screen.getByText('Roster Import (CSV)')).toBeTruthy();
    });

    const csv = [
      'workEmail,displayName,phoneE164,teamName',
      'dupe@velocitygp.dev,Dupe,,',
      'valid@velocitygp.dev,Valid,+15551234567,Apex',
    ].join('\n');

    const fileInput = screen
      .getByLabelText('Choose CSV')
      .parentElement?.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    if (!fileInput) {
      throw new Error('Expected file input for CSV upload.');
    }

    const file = new globalThis.File([csv], 'roster.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Loaded file: roster.csv/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview Import' }));

    await waitFor(() => {
      expect(screen.getByText(/Preview summary: 2 rows, 1 valid, 1 invalid/)).toBeTruthy();
    });

    expect(screen.getByText('Duplicate workEmail in import payload.')).toBeTruthy();
  });
});
