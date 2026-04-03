/**
 * API endpoint path builders.
 *
 * Centralized definitions of backend route paths shared by web and API callers.
 * Reference: docs/Tech Stack Needed.md for backend architecture.
 *
 * @module @velocity-gp/api-contract/endpoints
 */

// ============ GAME ENDPOINTS ============

export interface GetRaceStateRequest {
  eventId: string;
  playerId: string;
}

export const gameEndpoints = {
  getRaceState: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/race-state`,
  updateHazardStatus: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/hazard-status`,
  getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
};

// ============ PLAYER ENDPOINTS ============

export const playerEndpoints = {
  createPlayer: '/players',
  getProfile: (playerId: string) => `/players/${playerId}`,
  updateProfile: (playerId: string) => `/players/${playerId}`,
};

// ============ TEAM ENDPOINTS ============

export const teamEndpoints = {
  createTeam: '/teams',
  getTeam: (teamId: string) => `/teams/${teamId}`,
  joinTeam: (teamId: string) => `/teams/${teamId}/join`,
  getTeamMembers: (teamId: string) => `/teams/${teamId}/members`,
};

// ============ EVENT ENDPOINTS ============

export const eventEndpoints = {
  listEvents: '/events',
  getEvent: (eventId: string) => `/events/${eventId}`,
  getCurrentEvent: '/events/current',
};

// ============ HAZARD ENDPOINTS ============

export const hazardEndpoints = {
  scanQR: '/hazards/scan',
  getHazard: (hazardId: string) => `/hazards/${hazardId}`,
  listHazards: (eventId: string) => `/events/${eventId}/hazards`,
};

// ============ RESCUE ENDPOINTS ============

export const rescueEndpoints = {
  initiateRescue: '/rescue/initiate',
  getRescueStatus: (playerId: string) => `/rescue/${playerId}/status`,
  completeRescue: (playerId: string) => `/rescue/${playerId}/complete`,
};
