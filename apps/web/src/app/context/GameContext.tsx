import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SubmitScanResponse } from '@velocity-gp/api-contract';

import type { ScanIdentity } from '@/services/scan';
import { identifyAnalyticsUser, trackAnalyticsEvent } from '@/services/observability';
import {
  AUTH_SESSION_UPDATED_EVENT,
  getSession as getAuthSession,
  type AuthSession,
} from '@/services/auth';

// TODO(figma-sync): Add TeamMember-backed roster fields on Team for TeamPage/Admin parity (member list, contact metadata, per-member scoring). | Figma source: src/app/context/GameContext.tsx (Team.members, TeamMember) | Impact: user/admin flow
export interface Team {
  id: string;
  name: string;
  carImage?: string;
  score: number;
  rank: number;
  inPitStop: boolean;
  pitStopExpiresAt?: string;
  keywords?: string[];
}

// TODO(figma-sync): Expand scan model with member/team/qr identifiers required by Figma Admin player/team detail and scan-history views. | Figma source: src/app/context/GameContext.tsx (Scan.memberId/teamId/qrCodeId) | Impact: user/admin flow
export interface Scan {
  id: string;
  points: number;
  timestamp: Date;
  outcome: SubmitScanResponse['outcome'];
  payload: string;
  message: string;
}

export interface GameState {
  currentUser: {
    name: string;
    email: string;
    teamId: string | null;
    isHelios: boolean;
    eventId?: string;
    playerId?: string;
  } | null;
  teams: Team[];
  currentTeam: Team | null;
  scans: Scan[];
  // TODO(figma-sync): Introduce qrCodes and gameActive state branches expected by Figma Admin control and QR inventory screens. | Figma source: src/app/context/GameContext.tsx (GameState.qrCodes/gameActive) | Impact: admin flow
}

interface GameContextType {
  gameState: GameState;
  login: (name: string, email: string) => void;
  becomeHelios: () => void;
  createTeam: (teamName: string, carImage: string, keywords: string[]) => void;
  addScan: (points: number) => void;
  triggerPitStop: (teamId: string, duration: number) => void;
  clearPitStop: (teamId: string) => void;
  // TODO(figma-sync): Add admin command surface (score adjustments, QR CRUD/toggles, game active toggle, member updates) once Figma Admin parity work begins. | Figma source: src/app/context/GameContext.tsx admin actions | Impact: admin flow
  hydrateScanIdentity: (identity: ScanIdentity) => void;
  applyScanOutcome: (response: SubmitScanResponse) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

function withUpdatedRanks(teams: Team[]): Team[] {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const rankById = new Map(sorted.map((team, index) => [team.id, index + 1]));

  return teams.map((team) => ({
    ...team,
    rank: rankById.get(team.id) ?? team.rank,
  }));
}

function resolvePitStopSeconds(pitStopExpiresAt: string): number {
  const expiresAtMs = Date.parse(pitStopExpiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>({
    currentUser: null,
    teams: [],
    currentTeam: null,
    scans: [],
  });

  useEffect(() => {
    let active = true;

    const syncCurrentUserFromSession = async () => {
      // Auth session is the source of truth for current user identity across route reloads.
      const session = await getAuthSession();
      if (!active) {
        return;
      }

      setGameState((previousState) => ({
        ...previousState,
        currentUser: resolveCurrentUserFromSession(session),
      }));
    };

    void syncCurrentUserFromSession();

    const handleSessionChange = () => {
      void syncCurrentUserFromSession();
    };

    globalThis.addEventListener(AUTH_SESSION_UPDATED_EVENT, handleSessionChange);
    return () => {
      active = false;
      globalThis.removeEventListener(AUTH_SESSION_UPDATED_EVENT, handleSessionChange);
    };
  }, []);

  const login = (name: string, email: string) => {
    // @deprecated — use the magic-link auth flow. This local mutation does not
    // create a real session and will be removed when Garage is API-backed.
    globalThis.console.warn(
      '[GameContext] login() is deprecated. Use the magic-link auth flow instead.'
    );
    identifyAnalyticsUser(email, {
      name,
      team_id: '',
      is_helios: false,
    });
    trackAnalyticsEvent('auth_login_submitted', {
      login_channel: email.includes('@') ? 'email' : 'phone',
    });

    setGameState((prev) => ({
      ...prev,
      currentUser: {
        name,
        email,
        teamId: null,
        isHelios: false,
      },
    }));
  };

  const becomeHelios = () => {
    trackAnalyticsEvent('helios_role_enabled', {
      player_name: gameState.currentUser?.name ?? 'unknown',
    });

    setGameState((prev) => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, isHelios: true } : null,
    }));
  };

  const createTeam = (teamName: string, carImage: string, keywords: string[]) => {
    // @deprecated — team IDs generated here are local only and won't match the database.
    // Replace with an API-backed flow that returns a real team ID from the backend.
    globalThis.console.warn(
      '[GameContext] createTeam() is deprecated. Team IDs are not database-persisted.'
    );
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: teamName,
      carImage,
      score: 0,
      rank: gameState.teams.length + 1,
      inPitStop: false,
      keywords,
    };

    trackAnalyticsEvent('team_created', {
      team_id: newTeam.id,
      team_name: teamName,
      keyword_count: keywords.length,
    });

    setGameState((prev) => {
      const teams = withUpdatedRanks([...prev.teams, newTeam]);
      const currentTeam = teams.find((team) => team.id === newTeam.id) ?? newTeam;

      return {
        ...prev,
        teams,
        currentTeam,
        currentUser: prev.currentUser ? { ...prev.currentUser, teamId: newTeam.id } : null,
      };
    });
  };

  const addScan = (points: number) => {
    // @deprecated — use applyScanOutcome() with a server response instead.
    globalThis.console.warn(
      '[GameContext] addScan() is deprecated. Use applyScanOutcome() for server-driven scan updates.'
    );
    const newScan: Scan = {
      id: Date.now().toString(),
      points,
      timestamp: new Date(),
      outcome: 'SAFE',
      payload: 'manual',
      message: 'Manual scan update applied.',
    };

    trackAnalyticsEvent('qr_scan_recorded', {
      points_awarded: points,
      team_id: gameState.currentTeam?.id ?? 'unknown',
    });

    setGameState((prev) => {
      const currentTeam = prev.currentTeam
        ? { ...prev.currentTeam, score: prev.currentTeam.score + points }
        : null;
      const teams = withUpdatedRanks(
        prev.teams.map((team) => (currentTeam && team.id === currentTeam.id ? currentTeam : team))
      );

      return {
        ...prev,
        scans: [newScan, ...prev.scans].slice(0, 20),
        currentTeam,
        teams,
      };
    });
  };

  const triggerPitStop = (teamId: string, duration: number) => {
    trackAnalyticsEvent('pit_stop_started', {
      team_id: teamId,
      duration_seconds: duration,
    });

    setGameState((prev) => {
      const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
      return {
        ...prev,
        teams: prev.teams.map((team) =>
          team.id === teamId ? { ...team, inPitStop: true, pitStopExpiresAt: expiresAt } : team
        ),
        currentTeam:
          prev.currentTeam?.id === teamId
            ? { ...prev.currentTeam, inPitStop: true, pitStopExpiresAt: expiresAt }
            : prev.currentTeam,
      };
    });
  };

  const clearPitStop = (teamId: string) => {
    trackAnalyticsEvent('pit_stop_cleared', {
      team_id: teamId,
    });

    setGameState((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === teamId ? { ...team, inPitStop: false, pitStopExpiresAt: undefined } : team
      ),
      currentTeam:
        prev.currentTeam?.id === teamId
          ? { ...prev.currentTeam, inPitStop: false, pitStopExpiresAt: undefined }
          : prev.currentTeam,
    }));
  };

  const hydrateScanIdentity = (identity: ScanIdentity) => {
    setGameState((prev) => {
      // Seed team/current user context from scanner identity so downstream scan calls can
      // execute even before full roster hydration is available.
      const existingTeam = prev.teams.find((team) => team.id === identity.teamId);
      const seedTeam: Team = existingTeam ?? {
        id: identity.teamId,
        name: identity.teamName,
        score: 0,
        rank: prev.teams.length + 1,
        inPitStop: false,
      };

      const teams = withUpdatedRanks(
        existingTeam
          ? prev.teams.map((team) =>
              team.id === seedTeam.id ? { ...team, name: identity.teamName } : team
            )
          : [...prev.teams, seedTeam]
      );
      const currentTeam = teams.find((team) => team.id === identity.teamId) ?? seedTeam;

      return {
        ...prev,
        teams,
        currentTeam,
        currentUser: {
          name: prev.currentUser?.name ?? identity.email,
          email: identity.email,
          teamId: identity.teamId,
          isHelios: prev.currentUser?.isHelios ?? false,
          eventId: identity.eventId,
          playerId: identity.playerId,
        },
      };
    });
  };

  const applyScanOutcome = (response: SubmitScanResponse) => {
    setGameState((prev) => {
      const fallbackTeamId = prev.currentTeam?.id ?? null;
      // Backend teamId wins. Local team is fallback for older or partial response payloads.
      const resolvedTeamId = response.teamId ?? fallbackTeamId;

      const scanRecord: Scan = {
        id: response.scannedAt,
        points: response.pointsAwarded,
        timestamp: new Date(response.scannedAt),
        outcome: response.outcome,
        payload: response.qrPayload,
        message: response.message,
      };

      let teams = prev.teams;
      let currentTeam = prev.currentTeam;

      if (resolvedTeamId) {
        const existingTeam = teams.find((team) => team.id === resolvedTeamId);
        const createdTeam: Team = existingTeam ?? {
          id: resolvedTeamId,
          name: prev.currentTeam?.name ?? 'Race Team',
          score: 0,
          rank: teams.length + 1,
          inPitStop: false,
        };

        teams = existingTeam ? teams : [...teams, createdTeam];

        teams = teams.map((team) => {
          if (team.id !== resolvedTeamId) {
            return team;
          }

          const nextTeam: Team = { ...team };
          if ('teamScore' in response) {
            // Authoritative score from backend prevents drift from optimistic local mutations.
            nextTeam.score = response.teamScore;
          }

          if (response.outcome === 'HAZARD_PIT') {
            const pitStopDuration = resolvePitStopSeconds(response.pitStopExpiresAt);
            if (pitStopDuration > 0) {
              nextTeam.inPitStop = true;
              nextTeam.pitStopExpiresAt = response.pitStopExpiresAt;
            } else {
              nextTeam.inPitStop = false;
              nextTeam.pitStopExpiresAt = undefined;
            }
          }

          if (response.outcome === 'BLOCKED' && response.errorCode === 'TEAM_IN_PIT') {
            // Preserve pit-stop lock in UI when server rejects scans during lockout.
            nextTeam.inPitStop = true;
            if (!nextTeam.pitStopExpiresAt) {
              nextTeam.pitStopExpiresAt = new Date(Date.now() + 60 * 1000).toISOString();
            }
          }

          if (response.outcome === 'SAFE') {
            // Explicitly clear stale pit-stop state when a safe scan resumes team activity.
            nextTeam.inPitStop = false;
            nextTeam.pitStopExpiresAt = undefined;
          }

          return nextTeam;
        });

        teams = withUpdatedRanks(teams);
        currentTeam = teams.find((team) => team.id === resolvedTeamId) ?? currentTeam;
      }

      return {
        ...prev,
        scans: [scanRecord, ...prev.scans].slice(0, 20),
        teams,
        currentTeam,
      };
    });
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        login,
        becomeHelios,
        createTeam,
        addScan,
        triggerPitStop,
        clearPitStop,
        hydrateScanIdentity,
        applyScanOutcome,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

function resolveCurrentUserFromSession(session: AuthSession): GameState['currentUser'] {
  if (!session.isAuthenticated || !session.userId) {
    return null;
  }

  // Keep context shape stable even when optional profile fields are absent.
  return {
    name: session.displayName ?? session.email ?? 'Player',
    email: session.email ?? '',
    teamId: session.teamId ?? null,
    isHelios: session.role === 'helios',
    eventId: session.eventId,
    playerId: session.playerId,
  };
}
