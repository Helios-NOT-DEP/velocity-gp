// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminQrCodes from '../src/app/pages/admin/AdminQrCodes';
import { AUTH_SESSION_STORAGE_KEY, type AuthSession } from '../src/services/auth';

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

describe('AdminQrCodes hazard randomizer controls', () => {
  beforeEach(() => {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
    vi.restoreAllMocks();
  });

  it('persists configured weight and sends admin auth headers', async () => {
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
            startDate: '2026-04-06T10:00:00.000Z',
            endDate: '2026-04-06T18:00:00.000Z',
            status: 'ACTIVE',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: [
            {
              id: 'qr-alpha',
              eventId: 'event-1',
              label: 'Checkpoint Alpha',
              value: 100,
              zone: 'Atrium',
              payload: 'VG-ALPHA-01',
              status: 'ACTIVE',
              scanCount: 14,
              hazardRatioOverride: null,
              hazardWeightOverride: null,
              activationStartsAt: '2026-04-06T10:00:00.000Z',
              activationEndsAt: null,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            qrCodeId: 'qr-alpha',
            hazardWeightOverride: 77,
            updatedAt: '2026-04-06T12:05:00.000Z',
            auditId: 'audit-1',
          },
        })
      );

    render(<AdminQrCodes />);

    await waitFor(() => {
      expect(screen.getByText('Checkpoint Alpha')).toBeTruthy();
    });

    const weightInput = screen.getByLabelText('Hazard randomizer value for Checkpoint Alpha');
    fireEvent.change(weightInput, { target: { value: '77' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const [, , patchCall] = fetchMock.mock.calls;
    const [patchUrl, patchOptions] = patchCall as [string, RequestInit];

    expect(patchUrl).toContain('/admin/events/event-1/qr-codes/qr-alpha/hazard-randomizer');
    expect((patchOptions.headers as Record<string, string>)['x-user-id']).toBe('admin-1');
    expect((patchOptions.headers as Record<string, string>)['x-user-role']).toBe('admin');
    expect(JSON.parse(String(patchOptions.body))).toEqual({ hazardWeightOverride: 77 });

    await waitFor(() => {
      expect(screen.getByText('77%')).toBeTruthy();
    });
  });

  it('resets a QR code to fallback mode via null override', async () => {
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
            startDate: '2026-04-06T10:00:00.000Z',
            endDate: '2026-04-06T18:00:00.000Z',
            status: 'ACTIVE',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: [
            {
              id: 'qr-alpha',
              eventId: 'event-1',
              label: 'Checkpoint Alpha',
              value: 100,
              zone: 'Atrium',
              payload: 'VG-ALPHA-01',
              status: 'ACTIVE',
              scanCount: 14,
              hazardRatioOverride: 5,
              hazardWeightOverride: 40,
              activationStartsAt: '2026-04-06T10:00:00.000Z',
              activationEndsAt: null,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            qrCodeId: 'qr-alpha',
            hazardWeightOverride: null,
            updatedAt: '2026-04-06T12:05:00.000Z',
            auditId: 'audit-2',
          },
        })
      );

    render(<AdminQrCodes />);

    await waitFor(() => {
      expect(screen.getByText('Checkpoint Alpha')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Use Fallback' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const [, , patchCall] = fetchMock.mock.calls;
    const [, patchOptions] = patchCall as [string, RequestInit];

    expect(JSON.parse(String(patchOptions.body))).toEqual({ hazardWeightOverride: null });

    await waitFor(() => {
      expect(screen.getByText('Fallback')).toBeTruthy();
    });
  });
});
