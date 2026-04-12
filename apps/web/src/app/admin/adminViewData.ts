import type { Team } from '../context/GameContext';

export interface AdminQrCode {
  id: string;
  name: string;
  points: number;
  active: boolean;
  scanCount: number;
  hazardRatioOverride: number | null;
  hazardWeightOverride: number | null;
}

export interface AdminPlayerRow {
  id: string;
  name: string;
  teamName: string;
  score: number;
}

export const adminDemoQrCodes: AdminQrCode[] = [
  {
    id: 'qr-alpha',
    name: 'Checkpoint Alpha',
    points: 100,
    active: true,
    scanCount: 17,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
  },
  {
    id: 'qr-bridge',
    name: 'Bridge Sprint',
    points: 150,
    active: true,
    scanCount: 13,
    hazardRatioOverride: 5,
    hazardWeightOverride: 30,
  },
  {
    id: 'qr-pitwall',
    name: 'Pit Wall Bonus',
    points: 80,
    active: false,
    scanCount: 9,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
  },
  {
    id: 'qr-grid',
    name: 'Grid Launch',
    points: 120,
    active: true,
    scanCount: 11,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
  },
];

export function toSortedTeams(teams: Team[]): Team[] {
  // Centralized sorting keeps admin tables/cards in sync on score order.
  return [...teams].sort((a, b) => b.score - a.score);
}

export function toAdminPlayers(teams: Team[]): AdminPlayerRow[] {
  // Demo player rows are derived from teams until roster APIs replace placeholder data.
  return toSortedTeams(teams).map((team, index) => ({
    id: `player-${team.id}`,
    name: `${team.name} Driver`,
    teamName: team.name,
    score: Math.max(0, team.score - (index + 1) * 77),
  }));
}

export function rankBadgeClass(index: number): string {
  // Visual hierarchy mirrors podium ordering for first three teams.
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
