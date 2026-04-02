/**
 * Game Domain Models
 *
 * Core types for race, player, and game state.
 * Reference: docs/Velocity GP BDD Specifications.md
 *
 * @module models/game
 */

export interface Player {
  id: string;
  email: string;
  name: string;
  eventId: string;
  teamId?: string;
  status: 'IN_PIT' | 'RACING' | 'FINISHED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  eventId: string;
  members: string[]; // Player IDs
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Race {
  id: string;
  eventId: string;
  playerId: string;
  teamId: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'IN_PIT' | 'RACING' | 'FINISHED';
  currentLocation?: string;
  hazardsEncountered: Hazard[];
  score: number;
}

export interface Hazard {
  id: string;
  name: string;
  ratio: number; // Score penalty multiplier
  description: string;
  eventId: string;
  location?: string;
  qrCode?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Rescue {
  id: string;
  playerId: string;
  eventId: string;
  initiatedAt: Date;
  completedAt?: Date;
  status: 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED';
  reason: string;
}
