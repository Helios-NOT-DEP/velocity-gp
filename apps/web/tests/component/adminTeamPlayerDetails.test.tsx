// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import AdminTeams from '@/app/pages/admin/AdminTeams';
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

function renderWithRoutes(initialEntries: string[], routes: RouteObject[]) {
  const router = createMemoryRouter(routes, {
    initialEntries,
  });

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe('Admin team/player detail routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
    vi.restoreAllMocks();
  });

  it('navigates from teams list to team detail route', async () => {
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
            teams: [
              {
                teamId: 'team-1',
                teamName: 'Apex Team',
                teamStatus: 'ACTIVE',
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
            items: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                eventId: 'event-1',
                workEmail: 'player@velocitygp.dev',
                displayName: 'Player One',
                isHelios: false,
                phoneE164: null,
                teamId: 'team-1',
                teamName: 'Apex Team',
                teamStatus: 'ACTIVE',
                assignmentStatus: 'ASSIGNED_ACTIVE',
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
            eventId: 'event-1',
            teamId: 'team-1',
            teamName: 'Apex Team',
            teamStatus: 'ACTIVE',
            score: 1200,
            rank: 1,
            pitStopExpiresAt: null,
            keywords: [],
            memberCount: 1,
            members: [
              {
                playerId: 'player-1',
                userId: 'user-1',
                displayName: 'Player One',
                workEmail: 'player@velocitygp.dev',
                individualScore: 450,
                joinedAt: '2026-04-07T10:00:00.000Z',
                rank: 1,
              },
            ],
          },
        })
      );

    const { router } = renderWithRoutes(
      ['/admin/teams'],
      [
        { path: '/admin/teams', Component: AdminTeams },
        { path: '/admin/teams/:teamId', Component: AdminTeams },
      ]
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apex Team' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Detail' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/teams/team-1');
      expect(screen.getByRole('button', { name: 'Back to Teams' })).toBeTruthy();
      expect(screen.getByText('Ranked Members')).toBeTruthy();
    });
  });

  it('supports team-detail score/pit/delete actions via admin APIs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as typeof window.fetch;

    const teamDetailPayload = {
      success: true,
      data: {
        eventId: 'event-1',
        teamId: 'team-1',
        teamName: 'Apex Team',
        teamStatus: 'ACTIVE',
        score: 1200,
        rank: 1,
        pitStopExpiresAt: null,
        keywords: [],
        memberCount: 1,
        members: [
          {
            playerId: 'player-1',
            userId: 'user-1',
            displayName: 'Player One',
            workEmail: 'player@velocitygp.dev',
            individualScore: 450,
            joinedAt: '2026-04-07T10:00:00.000Z',
            rank: 1,
          },
        ],
      },
    };

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
      .mockResolvedValueOnce(buildJsonResponse(teamDetailPayload))
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            teamId: 'team-1',
            score: 1300,
            updatedAt: '2026-04-07T10:15:00.000Z',
            auditId: 'audit-score',
          },
        })
      )
      .mockResolvedValueOnce(buildJsonResponse(teamDetailPayload))
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            teamId: 'team-1',
            status: 'IN_PIT',
            pitStopExpiresAt: '2026-04-07T11:15:00.000Z',
            updatedAt: '2026-04-07T10:20:00.000Z',
            auditId: 'audit-pit',
          },
        })
      )
      .mockResolvedValueOnce(buildJsonResponse(teamDetailPayload))
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            teamId: 'team-1',
            deletedAt: '2026-04-07T10:25:00.000Z',
            unassignedPlayerCount: 1,
            auditId: 'audit-delete',
          },
        })
      )
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
      );

    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmSpy);

    const { router } = renderWithRoutes(
      ['/admin/teams/team-1'],
      [
        { path: '/admin/teams', Component: AdminTeams },
        { path: '/admin/teams/:teamId', Component: AdminTeams },
      ]
    );

    await waitFor(() => {
      expect(screen.getByText('Apex Team')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('/teams/team-1/score'))
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Pit' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) =>
            String(url).includes('/teams/team-1/pit-control') &&
            JSON.parse(String((options as RequestInit).body)).action === 'ENTER_PIT'
        )
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Team' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(router.state.location.pathname).toBe('/admin/teams');
    });

    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          String(url).includes('/admin/events/event-1/teams/team-1') &&
          (options as RequestInit).method === 'DELETE'
      )
    ).toBe(true);
  });

  it('navigates from player list to player detail and saves contact fields', async () => {
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
                workEmail: 'player@velocitygp.dev',
                displayName: 'Player One',
                isHelios: false,
                phoneE164: '+14155550100',
                teamId: 'team-1',
                teamName: 'Apex Team',
                teamStatus: 'ACTIVE',
                assignmentStatus: 'ASSIGNED_ACTIVE',
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
                teamName: 'Apex Team',
                teamStatus: 'ACTIVE',
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
      )
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
            eventId: 'event-1',
            playerId: 'player-1',
            userId: 'user-1',
            displayName: 'Player One',
            workEmail: 'player@velocitygp.dev',
            phoneE164: '+14155550100',
            joinedAt: '2026-04-07T10:00:00.000Z',
            individualScore: 330,
            globalRank: 2,
            teamId: 'team-1',
            teamName: 'Apex Team',
            teamScore: 1180,
            teamRank: 1,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                scanId: 'scan-1',
                eventId: 'event-1',
                playerId: 'player-1',
                teamId: 'team-1',
                qrCodeId: 'qr-1',
                qrCodeLabel: 'Checkpoint 1',
                qrPayload: 'payload-1',
                outcome: 'HAZARD_PIT',
                pointsAwarded: 0,
                scannedAt: '2026-04-07T10:30:00.000Z',
                message: 'hazard',
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
            eventId: 'event-1',
            playerId: 'player-1',
            userId: 'user-1',
            workEmail: 'player.updated@velocitygp.dev',
            phoneE164: '+14155550155',
            updatedAt: '2026-04-07T10:45:00.000Z',
            auditId: 'audit-contact',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            playerId: 'player-1',
            userId: 'user-1',
            displayName: 'Player One',
            workEmail: 'player.updated@velocitygp.dev',
            phoneE164: '+14155550155',
            joinedAt: '2026-04-07T10:00:00.000Z',
            individualScore: 330,
            globalRank: 2,
            teamId: 'team-1',
            teamName: 'Apex Team',
            teamScore: 1180,
            teamRank: 1,
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            items: [
              {
                scanId: 'scan-1',
                eventId: 'event-1',
                playerId: 'player-1',
                teamId: 'team-1',
                qrCodeId: 'qr-1',
                qrCodeLabel: 'Checkpoint 1',
                qrPayload: 'payload-1',
                outcome: 'HAZARD_PIT',
                pointsAwarded: 0,
                scannedAt: '2026-04-07T10:30:00.000Z',
                message: 'hazard',
              },
            ],
            nextCursor: null,
          },
        })
      );

    const { router } = renderWithRoutes(
      ['/admin/players'],
      [
        { path: '/admin/players', Component: AdminPlayers },
        { path: '/admin/players/:playerId', Component: AdminPlayers },
      ]
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Player One' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Player One' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/players/player-1');
      expect(screen.getByRole('button', { name: 'Back to Players' })).toBeTruthy();
      expect(screen.getByText('HAZARD')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'player.updated@velocitygp.dev' },
    });
    fireEvent.change(screen.getByLabelText('Phone (E.164)'), {
      target: { value: '+14155550155' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Contact' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('/admin/events/event-1/players/player-1/contact')
        )
      ).toBe(true);
    });

    const contactCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/admin/events/event-1/players/player-1/contact')
    );
    expect(contactCall).toBeTruthy();
    expect(JSON.parse(String((contactCall?.[1] as RequestInit).body))).toEqual({
      workEmail: 'player.updated@velocitygp.dev',
      phoneE164: '+14155550155',
    });
  });
});
