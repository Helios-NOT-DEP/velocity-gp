import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/services/auth';
import { derivePlayerIdentity } from '@/hooks/usePlayerSession';

function buildSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    userId: 'user-1',
    email: 'player@velocitygp.dev',
    role: 'player',
    isAuthenticated: true,
    playerId: 'player-1',
    teamId: 'team-1',
    eventId: 'event-1',
    ...overrides,
  };
}

describe('derivePlayerIdentity', () => {
  it('returns real IDs when session contains player context', () => {
    const identity = derivePlayerIdentity(buildSession(), false);

    expect(identity).toEqual({
      playerId: 'player-1',
      teamId: 'team-1',
      eventId: 'event-1',
      isRealSession: true,
    });
  });

  it('uses dev fallback IDs only in dev', () => {
    const identity = derivePlayerIdentity(buildSession({ playerId: undefined }), true);

    expect(identity.isRealSession).toBe(false);
    expect(identity.playerId).toBe('player-noah-active');
    expect(identity.teamId).toBe('team-nova-thunder');
    expect(identity.eventId).toBe('event-velocity-active');
  });

  it('returns null IDs when player context is missing outside dev', () => {
    const identity = derivePlayerIdentity(buildSession({ playerId: undefined }), false);

    expect(identity).toEqual({
      playerId: null,
      teamId: null,
      eventId: null,
      isRealSession: false,
    });
  });
});
