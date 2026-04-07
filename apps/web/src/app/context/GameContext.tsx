import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SubmitScanResponse } from '@velocity-gp/api-contract';

import type { ScanIdentity } from '@/services/scan';
import { identifyAnalyticsUser, trackAnalyticsEvent } from '@/services/observability';

export interface Team {
  id: string;
  name: string;
  carImage?: string;
  score: number;
  rank: number;
  inPitStop: boolean;
  pitStopTimeLeft?: number;
  keywords?: string[];
}

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
}

interface GameContextType {
  gameState: GameState;
  login: (name: string, email: string) => void;
  becomeHelios: () => void;
  createTeam: (teamName: string, carImage: string, keywords: string[]) => void;
  addScan: (points: number) => void;
  triggerPitStop: (teamId: string, duration: number) => void;
  clearPitStop: (teamId: string) => void;
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

const MOCK_TEAMS: Team[] = [
  { id: 'team-apex-comets', name: 'Apex Comets', score: 1260, rank: 1, inPitStop: false },
  { id: 'team-drift-runners', name: 'Drift Runners', score: 1110, rank: 2, inPitStop: false },
  {
    id: 'team-nova-thunder',
    name: 'Nova Thunder',
    score: 920,
    rank: 3,
    inPitStop: true,
    pitStopTimeLeft: 660,
  },
  { id: 'team-turbo-tigers', name: 'Turbo Tigers', score: 880, rank: 4, inPitStop: false },
  { id: 'team-neon-ninjas', name: 'Neon Ninjas', score: 820, rank: 5, inPitStop: false },
];

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
    teams: MOCK_TEAMS,
    currentTeam: null,
    scans: [],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        teams: prev.teams.map((team) => {
          if (team.inPitStop && team.pitStopTimeLeft) {
            const nextTime = team.pitStopTimeLeft - 1;
            if (nextTime <= 0) {
              return { ...team, inPitStop: false, pitStopTimeLeft: undefined };
            }

            return { ...team, pitStopTimeLeft: nextTime };
          }

          return team;
        }),
        currentTeam:
          prev.currentTeam && prev.currentTeam.inPitStop && prev.currentTeam.pitStopTimeLeft
            ? {
                ...prev.currentTeam,
                pitStopTimeLeft: Math.max(0, prev.currentTeam.pitStopTimeLeft - 1),
                inPitStop: prev.currentTeam.pitStopTimeLeft > 1,
              }
            : prev.currentTeam,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const login = (name: string, email: string) => {
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

    setGameState((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === teamId ? { ...team, inPitStop: true, pitStopTimeLeft: duration } : team
      ),
      currentTeam:
        prev.currentTeam?.id === teamId
          ? { ...prev.currentTeam, inPitStop: true, pitStopTimeLeft: duration }
          : prev.currentTeam,
    }));
  };

  const clearPitStop = (teamId: string) => {
    trackAnalyticsEvent('pit_stop_cleared', {
      team_id: teamId,
    });

    setGameState((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === teamId ? { ...team, inPitStop: false, pitStopTimeLeft: undefined } : team
      ),
      currentTeam:
        prev.currentTeam?.id === teamId
          ? { ...prev.currentTeam, inPitStop: false, pitStopTimeLeft: undefined }
          : prev.currentTeam,
    }));
  };

  const hydrateScanIdentity = (identity: ScanIdentity) => {
    setGameState((prev) => {
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
            nextTeam.score = response.teamScore;
          }

          if (response.outcome === 'HAZARD_PIT') {
            nextTeam.inPitStop = true;
            nextTeam.pitStopTimeLeft = resolvePitStopSeconds(response.pitStopExpiresAt);
          }

          if (response.outcome === 'BLOCKED' && response.errorCode === 'TEAM_IN_PIT') {
            nextTeam.inPitStop = true;
            if (!nextTeam.pitStopTimeLeft) {
              nextTeam.pitStopTimeLeft = 60;
            }
          }

          if (response.outcome === 'SAFE') {
            nextTeam.inPitStop = false;
            nextTeam.pitStopTimeLeft = undefined;
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
