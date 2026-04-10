import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEDUPE_WINDOW_MS,
  classifyQrPayload,
  createPayloadDedupeState,
  mapScanResponseToUiAction,
  resolveScanIdentityForEmail,
  shouldSuppressDuplicatePayload,
} from '@/services/scan';

const { getCurrentEventMock } = vi.hoisted(() => ({
  getCurrentEventMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  apiClient: {
    get: getCurrentEventMock,
  },
  eventEndpoints: {
    getCurrentEvent: '/events/current',
  },
}));

describe('scan identity resolver', () => {
  beforeEach(() => {
    getCurrentEventMock.mockReset();
  });

  it('resolves known seeded email when current event matches', async () => {
    getCurrentEventMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'event-velocity-active',
      },
    });

    const result = await resolveScanIdentityForEmail('lina@velocitygp.dev');

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      return;
    }

    expect(result.identity).toEqual({
      eventId: 'event-velocity-active',
      playerId: 'player-lina-active',
      teamId: 'team-apex-comets',
      teamName: 'Apex Comets',
      email: 'lina@velocitygp.dev',
    });
    expect(getCurrentEventMock).toHaveBeenCalledTimes(1);
  });

  it('returns unmapped for unknown email and skips event API lookup', async () => {
    const result = await resolveScanIdentityForEmail('unknown@velocitygp.dev');

    expect(result.status).toBe('unmapped');
    expect(getCurrentEventMock).not.toHaveBeenCalled();
  });

  it('returns event mismatch when seeded event differs from current event', async () => {
    getCurrentEventMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'event-other',
      },
    });

    const result = await resolveScanIdentityForEmail('parker@velocitygp.dev');

    expect(result.status).toBe('event_mismatch');
    if (result.status !== 'event_mismatch') {
      return;
    }

    expect(result.expectedEventId).toBe('event-velocity-active');
    expect(result.currentEventId).toBe('event-other');
  });
});

describe('QR payload classifier', () => {
  it('treats non-URL payloads as gameplay scans', () => {
    expect(classifyQrPayload('VG-ALPHA-01', 'https://dev.velocitygp.app')).toEqual({
      kind: 'gameplay',
      payload: 'VG-ALPHA-01',
    });
  });

  it('accepts URL payloads whose origin exactly matches the trusted origin', () => {
    expect(
      classifyQrPayload(
        'https://dev.velocitygp.app/login/callback?token=abc123',
        'https://dev.velocitygp.app'
      )
    ).toEqual({
      kind: 'trusted_url',
      payload: 'https://dev.velocitygp.app/login/callback?token=abc123',
      url: 'https://dev.velocitygp.app/login/callback?token=abc123',
    });
  });

  it('rejects URL payloads with a different domain', () => {
    const result = classifyQrPayload(
      'https://evil.example/login/callback?token=abc123',
      'https://dev.velocitygp.app'
    );

    expect(result.kind).toBe('untrusted_url');
    if (result.kind !== 'untrusted_url') {
      return;
    }

    expect(result.reason).toBe('origin_mismatch');
  });

  it('rejects URL payloads with the same host but a different protocol or port', () => {
    const differentProtocol = classifyQrPayload(
      'http://dev.velocitygp.app/login/callback?token=abc123',
      'https://dev.velocitygp.app'
    );
    const differentPort = classifyQrPayload(
      'https://dev.velocitygp.app:444/login/callback?token=abc123',
      'https://dev.velocitygp.app'
    );

    expect(differentProtocol.kind).toBe('untrusted_url');
    expect(differentPort.kind).toBe('untrusted_url');
  });

  it('rejects malformed URL-like payloads without crashing', () => {
    const malformedUrl = classifyQrPayload('https://', 'https://dev.velocitygp.app');
    const gameplayPayload = classifyQrPayload('VG-BRAVO-02', 'https://dev.velocitygp.app');

    expect(malformedUrl.kind).toBe('untrusted_url');
    if (malformedUrl.kind !== 'untrusted_url') {
      return;
    }

    expect(malformedUrl.reason).toBe('invalid_url');
    expect(gameplayPayload.kind).toBe('gameplay');
  });

  it('rejects URL payloads when the trusted origin is missing', () => {
    const result = classifyQrPayload(
      'https://dev.velocitygp.app/login/callback?token=abc123',
      undefined
    );

    expect(result.kind).toBe('untrusted_url');
    if (result.kind !== 'untrusted_url') {
      return;
    }

    expect(result.reason).toBe('missing_trusted_origin');
  });
});

describe('scan outcome mapper', () => {
  it('maps SAFE to success feedback and scanner resume', () => {
    const action = mapScanResponseToUiAction({
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
    });

    expect(action.feedback.level).toBe('success');
    expect(action.navigateTo).toBeNull();
    expect(action.shouldResumeScanner).toBe(true);
  });

  it('maps HAZARD_PIT to pit-stop navigation', () => {
    const action = mapScanResponseToUiAction({
      outcome: 'HAZARD_PIT',
      eventId: 'event-velocity-active',
      playerId: 'player-lina-active',
      teamId: 'team-apex-comets',
      qrCodeId: 'qr-1',
      qrPayload: 'VG-001',
      scannedAt: new Date().toISOString(),
      message: 'hazard',
      pointsAwarded: 0,
      teamScore: 1000,
      pitStopExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      hazardRatioUsed: 8,
    });

    expect(action.navigateTo).toBe('/pit-stop');
    expect(action.shouldResumeScanner).toBe(false);
  });

  it('maps TEAM_IN_PIT blocked responses to pit-stop navigation', () => {
    const action = mapScanResponseToUiAction({
      outcome: 'BLOCKED',
      eventId: 'event-velocity-active',
      playerId: 'player-lina-active',
      teamId: 'team-apex-comets',
      qrCodeId: 'qr-1',
      qrPayload: 'VG-001',
      scannedAt: new Date().toISOString(),
      message: 'blocked',
      pointsAwarded: 0,
      errorCode: 'TEAM_IN_PIT',
    });

    expect(action.feedback.level).toBe('warning');
    expect(action.navigateTo).toBe('/pit-stop');
    expect(action.shouldResumeScanner).toBe(false);
  });

  it('maps QR_DISABLED blocked responses to non-resumable error feedback', () => {
    const action = mapScanResponseToUiAction({
      outcome: 'BLOCKED',
      eventId: 'event-velocity-active',
      playerId: 'player-lina-active',
      teamId: 'team-apex-comets',
      qrCodeId: 'qr-1',
      qrPayload: 'VG-001',
      scannedAt: new Date().toISOString(),
      message: 'blocked',
      pointsAwarded: 0,
      errorCode: 'QR_DISABLED',
    });

    expect(action.feedback.level).toBe('error');
    expect(action.navigateTo).toBeNull();
    expect(action.shouldResumeScanner).toBe(false);
  });
});

describe('scan dedupe window', () => {
  it('suppresses same payload within dedupe window', () => {
    const now = Date.now();
    const previous = createPayloadDedupeState('VG-ABC-01', now);

    expect(shouldSuppressDuplicatePayload('VG-ABC-01', now + 500, previous)).toBe(true);
  });

  it('allows same payload after dedupe window', () => {
    const now = Date.now();
    const previous = createPayloadDedupeState('VG-ABC-01', now);

    expect(
      shouldSuppressDuplicatePayload('VG-ABC-01', now + DEFAULT_DEDUPE_WINDOW_MS + 1, previous)
    ).toBe(false);
  });

  it('does not suppress different payloads', () => {
    const now = Date.now();
    const previous = createPayloadDedupeState('VG-ABC-01', now);

    expect(shouldSuppressDuplicatePayload('VG-ABC-02', now + 200, previous)).toBe(false);
  });
});
