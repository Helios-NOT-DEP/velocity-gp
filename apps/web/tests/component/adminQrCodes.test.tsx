// @vitest-environment happy-dom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminQrCodes from '@/app/pages/admin/AdminQrCodes';
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

describe('AdminQrCodes operations', () => {
  beforeEach(() => {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
    vi.restoreAllMocks();
  });

  it('persists configured hazard weight and sends admin auth headers', async () => {
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
          data: {
            eventId: 'event-1',
            qrCodes: [
              {
                id: 'qr-alpha',
                eventId: 'event-1',
                label: 'Checkpoint Alpha',
                value: 100,
                zone: 'Atrium',
                payload: 'VG-ALPHA-01',
                qrImageUrl: 'https://cdn.velocitygp.app/qr/alpha.png',
                status: 'ACTIVE',
                scanCount: 14,
                hazardRatioOverride: null,
                hazardWeightOverride: null,
                activationStartsAt: '2026-04-06T10:00:00.000Z',
                activationEndsAt: null,
              },
            ],
          },
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

  it('creates a new QR code with zone and activation window fields', async () => {
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
          data: {
            eventId: 'event-1',
            qrCodes: [],
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            auditId: 'audit-created',
            qrCode: {
              id: 'qr-new',
              eventId: 'event-1',
              label: 'Checkpoint Delta',
              value: 150,
              zone: 'Roof',
              payload: 'VG-DELTA-09',
              qrImageUrl: 'https://cdn.velocitygp.app/qr/delta.png',
              status: 'ACTIVE',
              scanCount: 0,
              hazardRatioOverride: null,
              hazardWeightOverride: null,
              activationStartsAt: '2026-04-06T10:00:00.000Z',
              activationEndsAt: '2026-04-06T16:00:00.000Z',
            },
          },
        })
      );

    const { container } = render(<AdminQrCodes />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(screen.getByPlaceholderText('e.g., Checkpoint Alpha'), {
      target: { value: 'Checkpoint Delta' },
    });
    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Atrium'), { target: { value: 'Roof' } });
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(datetimeInputs[0], { target: { value: '2026-04-06T10:00' } });
    fireEvent.change(datetimeInputs[1], { target: { value: '2026-04-06T16:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Generate QR Code' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Checkpoint Delta')).toBeTruthy();
    });

    const [, , createCall] = fetchMock.mock.calls;
    const [createUrl, createOptions] = createCall as [string, RequestInit];
    expect(createUrl).toContain('/admin/events/event-1/qr-codes');
    expect(JSON.parse(String(createOptions.body))).toMatchObject({
      label: 'Checkpoint Delta',
      value: 150,
      zone: 'Roof',
    });
  });

  it('updates status and deletes a QR code using admin endpoints', async () => {
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
          data: {
            eventId: 'event-1',
            qrCodes: [
              {
                id: 'qr-alpha',
                eventId: 'event-1',
                label: 'Checkpoint Alpha',
                value: 100,
                zone: 'Atrium',
                payload: 'VG-ALPHA-01',
                qrImageUrl: 'https://cdn.velocitygp.app/qr/alpha.png',
                status: 'ACTIVE',
                scanCount: 14,
                hazardRatioOverride: null,
                hazardWeightOverride: null,
                activationStartsAt: null,
                activationEndsAt: null,
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            qrCodeId: 'qr-alpha',
            status: 'DISABLED',
            updatedAt: '2026-04-06T12:05:00.000Z',
            auditId: 'audit-status',
          },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          success: true,
          data: {
            eventId: 'event-1',
            qrCodeId: 'qr-alpha',
            deletedAt: '2026-04-06T12:10:00.000Z',
            auditId: 'audit-delete',
          },
        })
      );

    render(<AdminQrCodes />);

    await waitFor(() => {
      expect(screen.getByText('Checkpoint Alpha')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const [, , statusCall] = fetchMock.mock.calls;
    const [statusUrl, statusOptions] = statusCall as [string, RequestInit];
    expect(statusUrl).toContain('/admin/events/event-1/qr-codes/qr-alpha/status');
    expect(statusOptions.method).toBe('PATCH');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    const [, , , deleteCall] = fetchMock.mock.calls;
    const [deleteUrl, deleteOptions] = deleteCall as [string, RequestInit];
    expect(deleteUrl).toContain('/admin/events/event-1/qr-codes/qr-alpha');
    expect(deleteOptions.method).toBe('DELETE');

    await waitFor(() => {
      expect(screen.queryByText('Checkpoint Alpha')).toBeNull();
    });
  });
});
