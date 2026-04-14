/**
 * usePlayerSession hook
 *
 * Reads the current player's identity from localStorage (written by
 * `savePlayerSession` after a successful magic-link login).
 *
 * Returns three kinds of data:
 *
 *   1. `session`  — the full AuthSession object (userId, role, email, …)
 *   2. `player`   — the three IDs the Garage and Race Hub pages need:
 *                     playerId, teamId, eventId
 *                   Falls back to seeded dev values only in local development
 *                   so the app stays usable without going through login.
 *   3. `isReady`  — false on the first render (session hasn't been read yet);
 *                   true once the async read has resolved.  Show a loading
 *                   spinner while this is false.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 *
 *   On mount the hook calls `getSession()` (which may validate with the backend).
 *   If the session contains playerId/teamId/eventId those are used directly.
 *   If ANY of the three is missing, dev defaults are used only when `import.meta.env.DEV`
 *   is true; in non-dev environments the fields remain null.
 *
 * ── How to go live with Auth.js ─────────────────────────────────────────────
 *
 *   After the magic-link callback you will have a real Auth.js session.  Call:
 *
 *     const player = await apiClient.get('/players/me?eventId=xxx');
 *     savePlayerSession({ userId, email, playerId: player.id, teamId: player.teamId, eventId, role: 'player' });
 *     navigate('/garage');
 *
 *   The next time this hook runs it will pick up the saved values.
 *   Remove the DEV_DEFAULTS block below once Auth.js is wired end-to-end.
 */
import { useEffect, useState } from 'react';

import { getSession } from '@/services/auth';
import type { AuthSession } from '@/services/auth';

// ── Dev defaults (used when no real session exists) ──────────────────────────
// These match the seeded database records so the Garage page works immediately
// after `npm run seed` without going through the login flow.
// Delete this block (and the fallback logic below) when Auth.js is live.
const DEV_DEFAULTS = {
  playerId: 'player-noah-active',
  teamId: 'team-nova-thunder',
  eventId: 'event-velocity-active',
} as const;

// ── Public shape returned by the hook ────────────────────────────────────────

export interface PlayerIdentity {
  /** DB ID of the Player row (e.g. "player-lina-active") */
  playerId: string | null;
  /** DB ID of the team the player was pre-assigned to */
  teamId: string | null;
  /** DB ID of the current race event */
  eventId: string | null;
  /** true when all three IDs came from a real session; false = dev fallback */
  isRealSession: boolean;
}

export interface UsePlayerSessionResult {
  session: AuthSession | null;
  player: PlayerIdentity;
  /** false on first render; true once getSession() has resolved */
  isReady: boolean;
}

export function derivePlayerIdentity(session: AuthSession | null, isDev: boolean): PlayerIdentity {
  const hasRealSession =
    Boolean(session?.playerId) && Boolean(session?.teamId) && Boolean(session?.eventId);
  const canUseDevFallback = isDev && !hasRealSession;

  return {
    playerId: hasRealSession
      ? (session?.playerId ?? null)
      : canUseDevFallback
        ? DEV_DEFAULTS.playerId
        : null,
    teamId: hasRealSession
      ? (session?.teamId ?? null)
      : canUseDevFallback
        ? DEV_DEFAULTS.teamId
        : null,
    eventId: hasRealSession
      ? (session?.eventId ?? null)
      : canUseDevFallback
        ? DEV_DEFAULTS.eventId
        : null,
    isRealSession: hasRealSession,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlayerSession(): UsePlayerSessionResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // getSession() may make a backend validation request, so readiness tracks
    // completion of that async operation (not just localStorage hydration).
    getSession()
      .then((s) => {
        setSession(s);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  const player = derivePlayerIdentity(session, import.meta.env.DEV);

  return { session, player, isReady };
}
