import type { Team } from '../context/GameContext';

export interface AdminQrCode {
  id: string;
  name: string;
  points: number;
  active: boolean;
  scanCount: number;
}

export interface AdminPlayerRow {
  id: string;
  name: string;
  teamName: string;
  score: number;
}

export const adminDemoQrCodes: AdminQrCode[] = [
  { id: 'qr-alpha', name: 'Checkpoint Alpha', points: 100, active: true, scanCount: 17 },
  { id: 'qr-bridge', name: 'Bridge Sprint', points: 150, active: true, scanCount: 13 },
  { id: 'qr-pitwall', name: 'Pit Wall Bonus', points: 80, active: false, scanCount: 9 },
  { id: 'qr-grid', name: 'Grid Launch', points: 120, active: true, scanCount: 11 },
];

export function toSortedTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => b.score - a.score);
}

export function toAdminPlayers(teams: Team[]): AdminPlayerRow[] {
  return toSortedTeams(teams).map((team, index) => ({
    id: `player-${team.id}`,
    name: `${team.name} Driver`,
    teamName: team.name,
    score: Math.max(0, team.score - (index + 1) * 77),
  }));
}

export function rankBadgeClass(index: number): string {
  if (index === 0) {
    return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black';
  }
  if (index === 1) {
    return 'bg-gradient-to-br from-gray-300 to-gray-500 text-black';
  }
  if (index === 2) {
    return 'bg-gradient-to-br from-orange-400 to-orange-600 text-black';
  }
  return 'bg-gray-800 text-gray-400';
}
