import React, { createContext, useContext, useState, useEffect } from 'react';

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
}

export interface GameState {
  currentUser: {
    name: string;
    teamId: string;
    isHelios: boolean;
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
  { id: '1', name: 'Turbo Tigers', score: 24500, rank: 1, inPitStop: false },
  { id: '2', name: 'The Ultras', score: 23800, rank: 2, inPitStop: false },
  { id: '3', name: 'Risk Racers', score: 21200, rank: 3, inPitStop: false },
  { id: '4', name: 'Team Alpha', score: 19400, rank: 4, inPitStop: true, pitStopTimeLeft: 720 },
  { id: '5', name: 'Speed Demons', score: 18900, rank: 5, inPitStop: false },
  { id: '6', name: 'Neon Ninjas', score: 17600, rank: 6, inPitStop: false },
  { id: '7', name: 'Cyber Cyclones', score: 16800, rank: 7, inPitStop: false },
  { id: '8', name: 'Velocity Vipers', score: 15200, rank: 8, inPitStop: false },
  { id: '9', name: 'Apex Predators', score: 14700, rank: 9, inPitStop: false },
  { id: '10', name: 'Thunder Bolts', score: 13500, rank: 10, inPitStop: false },
  { id: '11', name: 'Phoenix Force', score: 12900, rank: 11, inPitStop: false },
  { id: '12', name: 'Grid Warriors', score: 11800, rank: 12, inPitStop: false },
  { id: '13', name: 'Nitro Knights', score: 10500, rank: 13, inPitStop: false },
  { id: '14', name: 'Sonic Surge', score: 9200, rank: 14, inPitStop: false },
  { id: '15', name: 'Flash Runners', score: 8100, rank: 15, inPitStop: false },
];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>({
    currentUser: null,
    teams: MOCK_TEAMS,
    currentTeam: null,
    scans: [],
  });

  // Countdown pit stop timers
  useEffect(() => {
    const interval = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        teams: prev.teams.map((team) => {
          if (team.inPitStop && team.pitStopTimeLeft) {
            const newTime = team.pitStopTimeLeft - 1;
            if (newTime <= 0) {
              return { ...team, inPitStop: false, pitStopTimeLeft: undefined };
            }
            return { ...team, pitStopTimeLeft: newTime };
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
    setGameState((prev) => ({
      ...prev,
      currentUser: {
        name,
        teamId: '',
        isHelios: false,
      },
    }));
  };

  const becomeHelios = () => {
    setGameState((prev) => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, isHelios: true } : null,
    }));
  };

  const createTeam = (teamName: string, carImage: string, keywords: string[]) => {
    const newTeam: Team = {
      id: Date.now().toString(),
      name: teamName,
      carImage,
      score: 0,
      rank: gameState.teams.length + 1,
      inPitStop: false,
      keywords,
    };

    setGameState((prev) => ({
      ...prev,
      teams: [...prev.teams, newTeam],
      currentTeam: newTeam,
      currentUser: prev.currentUser ? { ...prev.currentUser, teamId: newTeam.id } : null,
    }));
  };

  const addScan = (points: number) => {
    const newScan: Scan = {
      id: Date.now().toString(),
      points,
      timestamp: new Date(),
    };

    setGameState((prev) => {
      const updatedTeam = prev.currentTeam
        ? { ...prev.currentTeam, score: prev.currentTeam.score + points }
        : null;

      return {
        ...prev,
        scans: [newScan, ...prev.scans].slice(0, 20),
        currentTeam: updatedTeam,
        teams: prev.teams.map((team) => (team.id === prev.currentTeam?.id ? updatedTeam! : team)),
      };
    });
  };

  const triggerPitStop = (teamId: string, duration: number) => {
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
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
