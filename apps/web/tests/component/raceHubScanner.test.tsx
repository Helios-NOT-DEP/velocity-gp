// @vitest-environment happy-dom
/* global navigator */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import RaceHub from '@/app/pages/RaceHub';
import { GameProvider } from '@/app/context/GameContext';

const {
  getSessionMock,
  resolveScanIdentityForEmailMock,
  trackAnalyticsEventMock,
  submitScanMock,
  redirectToTrustedQrUrlMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  resolveScanIdentityForEmailMock: vi.fn(),
  trackAnalyticsEventMock: vi.fn(),
  submitScanMock: vi.fn(),
  redirectToTrustedQrUrlMock: vi.fn(),
}));

let latestScannerProps: {
  onScan: (detectedCodes: Array<{ rawValue: string }>) => void;
  onError?: (error: unknown) => void;
  paused?: boolean;
} | null = null;

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: {
    onScan: (detectedCodes: Array<{ rawValue: string }>) => void;
    onError?: (error: unknown) => void;
    paused?: boolean;
  }) => {
    latestScannerProps = props;
    return <div data-testid="mock-qr-scanner">Scanner mounted</div>;
  },
}));

vi.mock('@/services/auth', () => ({
  getSession: getSessionMock,
  AUTH_SESSION_UPDATED_EVENT: 'velocitygp.auth.session.updated',
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    post: submitScanMock,
  },
  scanEndpoints: {
    submitScan: (eventId: string) => `/events/${eventId}/scans`,
  },
}));

vi.mock('@/services/observability', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock('@/services/scan', async () => {
  const actual = await vi.importActual<typeof import('@/services/scan')>('@/services/scan');

  return {
    ...actual,
    resolveScanIdentityForEmail: resolveScanIdentityForEmailMock,
    redirectToTrustedQrUrl: redirectToTrustedQrUrlMock,
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

function createDetectedCode(rawValue: string) {
  return {
    rawValue,
    format: 'qr_code',
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    cornerPoints: [],
  };
}

async function startScanner() {
  await screen.findByRole('button', { name: /Start Camera Scan/i }, { timeout: 5_000 });
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /Start Camera Scan/i })).not.toBeDisabled();
    },
    { timeout: 5_000 }
  );

  fireEvent.click(screen.getByRole('button', { name: /Start Camera Scan/i }));

  await waitFor(
    () => {
      expect(latestScannerProps).not.toBeNull();
      expect(screen.getByRole('button', { name: /Stop Scanner/i })).toBeInTheDocument();
    },
    { timeout: 5_000 }
  );
}

const originalMediaDevices = navigator.mediaDevices;

const resolvedIdentity = {
  status: 'resolved' as const,
  identity: {
    eventId: 'event-velocity-active',
    playerId: 'player-lina-active',
    teamId: 'team-apex-comets',
    teamName: 'Apex Comets',
    email: 'lina@velocitygp.dev',
  },
};

const SCANNER_TEST_TIMEOUT_MS = 15_000;

describe('RaceHub scanner hybrid QR behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FRONTEND_MAGIC_LINK_ORIGIN', 'https://dev.velocitygp.app');
    latestScannerProps = null;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
    });

    getSessionMock.mockResolvedValue({
      userId: null,
      role: 'anonymous',
      isAuthenticated: false,
      email: 'lina@velocitygp.dev',
    });
    resolveScanIdentityForEmailMock.mockResolvedValue(resolvedIdentity);
    submitScanMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        outcome: 'SAFE',
        eventId: 'event-velocity-active',
        playerId: 'player-lina-active',
        teamId: 'team-apex-comets',
        qrCodeId: 'qr-1',
        qrPayload: 'VG-001',
        scannedAt: new Date().toISOString(),
        message: 'safe',
        pointsAwarded: 120,
        teamScore: 1000,
        claimCreated: true,
        hazardRatioUsed: 8,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it(
    'redirects when the scanned QR URL matches the trusted frontend origin',
    { timeout: SCANNER_TEST_TIMEOUT_MS },
    async () => {
      renderRaceHub();
      await startScanner();

      await act(async () => {
        latestScannerProps?.onScan([
          createDetectedCode('https://dev.velocitygp.app/login/callback?token=abc123'),
        ]);
      });

      await waitFor(() => {
        expect(redirectToTrustedQrUrlMock).toHaveBeenCalledWith(
          'https://dev.velocitygp.app/login/callback?token=abc123'
        );
      });
      expect(submitScanMock).not.toHaveBeenCalled();
    }
  );

  it(
    'blocks redirect when the scanned QR URL uses a different origin',
    { timeout: SCANNER_TEST_TIMEOUT_MS },
    async () => {
      renderRaceHub();
      await startScanner();

      await act(async () => {
        latestScannerProps?.onScan([
          createDetectedCode('https://evil.example/login/callback?token=abc123'),
        ]);
      });

      expect(redirectToTrustedQrUrlMock).not.toHaveBeenCalled();
      expect(submitScanMock).not.toHaveBeenCalled();
      await screen.findByText('Untrusted QR URL');
      expect(
        screen.getByText(
          'Only QR links from https://dev.velocitygp.app can redirect from Race Hub.'
        )
      ).toBeInTheDocument();
    }
  );

  it(
    'submits non-URL QR payloads to the gameplay scan API',
    { timeout: SCANNER_TEST_TIMEOUT_MS },
    async () => {
      renderRaceHub();
      await startScanner();

      await act(async () => {
        latestScannerProps?.onScan([createDetectedCode('VG-001')]);
      });

      await waitFor(() => {
        expect(submitScanMock).toHaveBeenCalledWith('/events/event-velocity-active/scans', {
          playerId: 'player-lina-active',
          qrPayload: 'VG-001',
        });
      });
      expect(redirectToTrustedQrUrlMock).not.toHaveBeenCalled();
      expect(await screen.findByText('Scan Registered')).toBeInTheDocument();
    }
  );

  it(
    'suppresses duplicate gameplay payloads within the dedupe window',
    { timeout: SCANNER_TEST_TIMEOUT_MS },
    async () => {
      renderRaceHub();
      await startScanner();

      await act(async () => {
        latestScannerProps?.onScan([createDetectedCode('VG-001')]);
      });

      await waitFor(() => {
        expect(submitScanMock).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        latestScannerProps?.onScan([createDetectedCode('VG-001')]);
      });

      expect(submitScanMock).toHaveBeenCalledTimes(1);
    }
  );
});
