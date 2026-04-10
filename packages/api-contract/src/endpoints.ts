/**
 * API endpoint path builders.
 */

export interface GetRaceStateRequest {
  eventId: string;
  playerId: string;
}

export const raceStateEndpoints = {
  getRaceState: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/race-state`,
  getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
};

export const scanEndpoints = {
  // Preferred scan ingestion endpoint.
  submitScan: (eventId: string) => `/events/${eventId}/scans`,
  // Compatibility endpoint retained for older scanner callers.
  legacySubmitScan: '/hazards/scan',
  updateHazardStatus: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/hazard-status`,
};

export const playerEndpoints = {
  createPlayer: '/players',
  getProfile: (playerId: string) => `/players/${playerId}`,
  updateProfile: (playerId: string) => `/players/${playerId}`,
};

export const teamEndpoints = {
  createTeam: '/teams',
  getTeam: (teamId: string) => `/teams/${teamId}`,
  joinTeam: (teamId: string) => `/teams/${teamId}/join`,
  getTeamMembers: (teamId: string) => `/teams/${teamId}/members`,
};

export const eventEndpoints = {
  listEvents: '/events',
  getEvent: (eventId: string) => `/events/${eventId}`,
  getCurrentEvent: '/events/current',
};

export const qrEndpoints = {
  getQRCode: (qrCodeId: string) => `/qr-codes/${qrCodeId}`,
  listQRCodes: (eventId: string) => `/events/${eventId}/qr-codes`,
  createQRCode: (eventId: string) => `/events/${eventId}/qr-codes`,
  setQRCodeStatus: (eventId: string, qrCodeId: string) =>
    `/events/${eventId}/qr-codes/${qrCodeId}/status`,
};

export const rescueEndpoints = {
  initiateRescue: '/rescue/initiate',
  getRescueStatus: (playerId: string) => `/rescue/${playerId}/status`,
  completeRescue: (playerId: string) => `/rescue/${playerId}/complete`,
};

export const adminEndpoints = {
  getSession: '/admin/session',
  updateRaceControl: (eventId: string) => `/admin/events/${eventId}/race-control`,
  manualPitControl: (eventId: string, teamId: string) =>
    `/admin/events/${eventId}/teams/${teamId}/pit-control`,
  listRoster: (eventId: string) => `/admin/events/${eventId}/roster`,
  listRosterTeams: (eventId: string) => `/admin/events/${eventId}/roster/teams`,
  updateRosterAssignment: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/roster/players/${playerId}/assignment`,
  previewRosterImport: (eventId: string) => `/admin/events/${eventId}/roster/import/preview`,
  applyRosterImport: (eventId: string) => `/admin/events/${eventId}/roster/import/apply`,
  updateQrHazardRandomizer: (eventId: string, qrCodeId: string) =>
    `/admin/events/${eventId}/qr-codes/${qrCodeId}/hazard-randomizer`,
  updateHeliosRole: (userId: string) => `/admin/users/${userId}/helios-role`,
  listAuditEntries: (eventId: string) => `/admin/events/${eventId}/audits`,
};

export const authEndpoints = {
  requestMagicLink: '/auth/magic-link/request',
  verifyMagicLink: '/auth/magic-link/verify',
  // Session/routing endpoints derive state from Authorization bearer tokens.
  getSession: '/auth/session',
  getRoutingDecision: '/auth/routing-decision',
};

// Legacy aliases retained while callers migrate.
export const gameEndpoints = {
  getRaceState: raceStateEndpoints.getRaceState,
  updateHazardStatus: scanEndpoints.updateHazardStatus,
  getLeaderboard: raceStateEndpoints.getLeaderboard,
};

export const hazardEndpoints = {
  scanQR: scanEndpoints.legacySubmitScan,
  getHazard: qrEndpoints.getQRCode,
  listHazards: qrEndpoints.listQRCodes,
};
