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
 *                   Falls back to seeded dev values so the app stays usable
 *                   during local development without going through login.
 *   3. `isReady`  — false on the first render (session hasn't been read yet);
 *                   true once the async read has resolved.  Show a loading
 *                   spinner while this is false.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 *
 *   On mount the hook calls `getSession()` (which reads localStorage).
 *   If the session contains playerId/teamId/eventId those are used directly.
 *   If ANY of the three is missing the hook falls back to the dev defaults so
 *   the Garage page can still be exercised without a real login.
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
  playerId: string;
  /** DB ID of the team the player was pre-assigned to */
  teamId: string;
  /** DB ID of the current race event */
  eventId: string;
  /** true when all three IDs came from a real session; false = dev fallback */
  isRealSession: boolean;
}

export interface UsePlayerSessionResult {
  session: AuthSession | null;
  player: PlayerIdentity;
  /** false on first render; true once localStorage has been read */
  isReady: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlayerSession(): UsePlayerSessionResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // getSession() reads synchronously from localStorage behind an async wrapper;
    // this resolves on the first microtask tick.
    getSession()
      .then((s) => {
        setSession(s);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  // Derive player identity — prefer real session values; fall back to dev defaults
  const hasRealSession =
    Boolean(session?.playerId) && Boolean(session?.teamId) && Boolean(session?.eventId);

  const player: PlayerIdentity = {
    playerId: session?.playerId ?? DEV_DEFAULTS.playerId,
    teamId: session?.teamId ?? DEV_DEFAULTS.teamId,
    eventId: session?.eventId ?? DEV_DEFAULTS.eventId,
    isRealSession: hasRealSession,
  };

  return { session, player, isReady };
}
