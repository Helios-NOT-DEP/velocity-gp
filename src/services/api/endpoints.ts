/**
 * API Endpoints & Types
 *
 * Centralized definitions of all backend API endpoints and their request/response types.
 * Reference: docs/Tech Stack Needed.md for backend architecture.
 *
 * @module services/api/endpoints
 */

// ============ GAME ENDPOINTS ============

export interface GetRaceStateRequest {
  eventId: string;
  playerId: string;
}

export interface GetRaceStateResponse {
  playerId: string;
  eventId: string;
  currentLocation: string;
  teamId: string;
  hazardsEncountered: string[];
  score: number;
  status: 'IN_PIT' | 'RACING' | 'FINISHED';
}

export const gameEndpoints = {
  getRaceState: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/race-state`,
  updateHazardStatus: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/hazard-status`,
  getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
};

// ============ PLAYER ENDPOINTS ============

export interface CreatePlayerRequest {
  email: string;
  name: string;
  eventId: string;
}

export interface PlayerProfile {
  id: string;
  email: string;
  name: string;
  eventId: string;
  createdAt: string;
}

export const playerEndpoints = {
  createPlayer: '/players',
  getProfile: (playerId: string) => `/players/${playerId}`,
  updateProfile: (playerId: string) => `/players/${playerId}`,
};

// ============ TEAM ENDPOINTS ============

export interface Team {
  id: string;
  name: string;
  eventId: string;
  members: string[];
  score: number;
}

export const teamEndpoints = {
  createTeam: '/teams',
  getTeam: (teamId: string) => `/teams/${teamId}`,
  joinTeam: (teamId: string) => `/teams/${teamId}/join`,
  getTeamMembers: (teamId: string) => `/teams/${teamId}/members`,
};

// ============ EVENT ENDPOINTS ============

export interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
}

export const eventEndpoints = {
  listEvents: '/events',
  getEvent: (eventId: string) => `/events/${eventId}`,
  getCurrentEvent: '/events/current',
};

// ============ HAZARD ENDPOINTS ============

export interface Hazard {
  id: string;
  name: string;
  ratio: number;
  description: string;
  eventId: string;
}

export const hazardEndpoints = {
  scanQR: '/hazards/scan',
  getHazard: (hazardId: string) => `/hazards/${hazardId}`,
  listHazards: (eventId: string) => `/events/${eventId}/hazards`,
};

// ============ RESCUE ENDPOINTS ============

export interface HeliosRescueFlow {
  playerId: string;
  eventId: string;
  initiatedAt: string;
  status: 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export const rescueEndpoints = {
  initiateRescue: '/rescue/initiate',
  getRescueStatus: (playerId: string) => `/rescue/${playerId}/status`,
  completeRescue: (playerId: string) => `/rescue/${playerId}/complete`,
};
