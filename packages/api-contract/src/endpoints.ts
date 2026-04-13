/**
 * @file endpoints.ts
 * @description Centralized registry of all API endpoint path builders used across the Velocity GP application.
 * By defining all endpoint structures here, we maintain a single source of truth that the frontend
 * `api-client` and backend Express routes can both reference. This prevents route mismatches
 * and makes refactoring URL structures safe and predictable.
 */

/**
 * Request payload for obtaining the current state of the race
 * for a specific player within an event.
 */
export interface GetRaceStateRequest {
  eventId: string;
  playerId: string;
}

/**
 * Endpoints for retrieving the active race state and leaderboard data.
 * Used heavily by the GameContext and RaceHub pages to synchronize game progress.
 */
export const raceStateEndpoints = {
  /** Retrieves the combined race/scanner state for a given player in an event. */
  getRaceState: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/race-state`,
  /** Retrieves the current top team standings and overall leaderboard for an event. */
  getLeaderboard: (eventId: string) => `/events/${eventId}/leaderboard`,
};

/**
 * Endpoints for core gameplay actions, primarily the QR scanning mechanic.
 * Handles both the submission of new scans and updating player state post-hazard.
 */
export const scanEndpoints = {
  /** The standard ingestion endpoint for player QR scans. */
  submitScan: (eventId: string) => `/events/${eventId}/scans`,
  /** Legacy alias for scan submissions, retained for compatibility with older scanner app version callers. */
  legacySubmitScan: '/hazards/scan',
  /** Updates the player's status when they successfully clear a hazard state. */
  updateHazardStatus: (eventId: string, playerId: string) =>
    `/events/${eventId}/players/${playerId}/hazard-status`,
};

/**
 * Endpoints for managing individual player profiles and registrations.
 */
export const playerEndpoints = {
  /** Registers a new player via email/name in the system. */
  createPlayer: '/players',
  /** Retrieves public/private profile details for an existing player. */
  getProfile: (playerId: string) => `/players/${playerId}`,
  /** Modifies player details, including their team assignment. */
  updateProfile: (playerId: string) => `/players/${playerId}`,
};

/**
 * Endpoints for grouping players into Teams and managing team state.
 * Teams are the primary competitive unit in the multi-day endurance events.
 */
export const teamEndpoints = {
  /** Bootstraps a new team for a specific event. */
  createTeam: '/teams',
  /** Retrieves current team scoring, status, and metadata. */
  getTeam: (teamId: string) => `/teams/${teamId}`,
  /** Enrolls a player into a designated team. */
  joinTeam: (teamId: string) => `/teams/${teamId}/join`,
  /** Retrieves the roster of players currently in a team. */
  getTeamMembers: (teamId: string) => `/teams/${teamId}/members`,
};

/**
 * Endpoints to query top-level Event structures. Events represent instances of the game
 * (e.g. "Velocity GP 2024") and encapsulate players, teams, and configurations.
 */
export const eventEndpoints = {
  /** Returns a summary catalog of all events. */
  listEvents: '/events',
  /** Retrieves detailed configuration for a specific event by ID. */
  getEvent: (eventId: string) => `/events/${eventId}`,
  /** Resolves the currently active (running) event context. */
  getCurrentEvent: '/events/current',
  /** Leverages the user's active session token to look up their player identity and event. */
  getCurrentEventPlayer: '/events/current/players/me',
  /** Lists the running activity feed for a single team in an event. */
  listTeamActivityFeed: (eventId: string, teamId: string) =>
    `/events/${eventId}/teams/${teamId}/activity-feed`,
};

/**
 * Endpoints for managing the library of QR codes and hazards deployed during an event.
 */
export const qrEndpoints = {
  /** Fetches metadata about a specific QR code, including any linked hazards. */
  getQRCode: (qrCodeId: string) => `/qr-codes/${qrCodeId}`,
  /** Retrieves the full deployment list of QR codes for an event. */
  listQRCodes: (eventId: string) => `/events/${eventId}/qr-codes`,
  /** Provisions a new QR code configuration. */
  createQRCode: (eventId: string) => `/events/${eventId}/qr-codes`,
  /** Updates administrative status (e.g. active vs retired) on a deployed QR code. */
  setQRCodeStatus: (eventId: string, qrCodeId: string) =>
    `/events/${eventId}/qr-codes/${qrCodeId}/status`,
};

/**
 * Endpoints supporting the "Rescue" cooperative mechanic, where players
 * assist teams out of 'PIT' hazards before the timer expires.
 */
export const rescueEndpoints = {
  /** Starts a rescue workflow handled by HELIOS staff or authorized players. */
  initiateRescue: '/rescue/initiate',
  /** Polls the status of an active rescue attempt for a player. */
  getRescueStatus: (playerId: string) => `/rescue/${playerId}/status`,
  /** Finalizes a rescue sequence, freeing the trapped player/team. */
  completeRescue: (playerId: string) => `/rescue/${playerId}/complete`,
};

/**
 * Administrative and back-office endpoints restricted to ADMIN or HELIOS roles.
 * Includes tools for overriding game state, auditing, and roster management.
 */
export const adminEndpoints = {
  /** Returns admin-specific session metadata. */
  getSession: '/admin/session',
  /** Reads the active race-control state for an event. */
  getRaceControl: (eventId: string) => `/admin/events/${eventId}/race-control`,
  /** Pauses/resumes the active race or impacts global race mechanics. */
  updateRaceControl: (eventId: string) => `/admin/events/${eventId}/race-control`,
  /** Forcibly places or clears a team from a PIT penalty sequence. */
  manualPitControl: (eventId: string, teamId: string) =>
    `/admin/events/${eventId}/teams/${teamId}/pit-control`,
  /** Returns team-level detail data for admin drill-down views. */
  getTeamDetail: (eventId: string, teamId: string) =>
    `/admin/events/${eventId}/teams/${teamId}/detail`,
  /** Overrides a team's score directly from the admin detail screen. */
  updateTeamScore: (eventId: string, teamId: string) =>
    `/admin/events/${eventId}/teams/${teamId}/score`,
  /** Soft-deletes a team from active admin operations. */
  deleteTeam: (eventId: string, teamId: string) => `/admin/events/${eventId}/teams/${teamId}`,
  /** Retrieves the full participant registry for an event. */
  listRoster: (eventId: string) => `/admin/events/${eventId}/roster`,
  /** Retrieves a bulk list of all teams constructed for the roster. */
  listRosterTeams: (eventId: string) => `/admin/events/${eventId}/roster/teams`,
  /** Forcibly re-assigns a player to a new team or role. */
  updateRosterAssignment: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/roster/players/${playerId}/assignment`,
  /** Returns player-level detail data for admin drill-down views. */
  getPlayerDetail: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/players/${playerId}/detail`,
  /** Updates admin-managed player contact information. */
  updatePlayerContact: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/players/${playerId}/contact`,
  /** Resolves and clears the review flag for a player. */
  resolvePlayerReviewFlag: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/players/${playerId}/review-flag`,
  /** Lists scan history rows for a specific player in an event. */
  listPlayerScanHistory: (eventId: string, playerId: string) =>
    `/admin/events/${eventId}/players/${playerId}/scan-history`,
  /** Validates a CSV/JSON bulk roster import payload without committing it. */
  previewRosterImport: (eventId: string) => `/admin/events/${eventId}/roster/import/preview`,
  /** Commits a bulk roster import payload to the database. */
  applyRosterImport: (eventId: string) => `/admin/events/${eventId}/roster/import/apply`,
  /** Adjusts the probabilities/randomizer for QR hazards dynamically mid-game. */
  updateQrHazardRandomizer: (eventId: string, qrCodeId: string) =>
    `/admin/events/${eventId}/qr-codes/${qrCodeId}/hazard-randomizer`,
  /** Reads global hazard settings for an event. */
  getHazardSettings: (eventId: string) => `/admin/events/${eventId}/hazard-settings`,
  /** Updates global hazard settings for an event. */
  updateHazardSettings: (eventId: string) => `/admin/events/${eventId}/hazard-settings`,
  /** Validates a bulk QR import payload and returns line-level errors. */
  previewQrImport: (eventId: string) => `/admin/events/${eventId}/qr-codes/import/preview`,
  /** Applies valid rows from a bulk QR import payload. */
  applyQrImport: (eventId: string) => `/admin/events/${eventId}/qr-codes/import/apply`,
  /** Exports QR image assets and a manifest archive for selected QR codes. */
  exportQrAssets: (eventId: string) => `/admin/events/${eventId}/qr-codes/export`,
  /** Lists scheduled hazard multiplier rules for an event. */
  listHazardMultipliers: (eventId: string) => `/admin/events/${eventId}/hazard-multipliers`,
  /** Creates a scheduled hazard multiplier rule for an event. */
  createHazardMultiplier: (eventId: string) => `/admin/events/${eventId}/hazard-multipliers`,
  /** Updates a scheduled hazard multiplier rule for an event. */
  updateHazardMultiplier: (eventId: string, ruleId: string) =>
    `/admin/events/${eventId}/hazard-multipliers/${ruleId}`,
  /** Deletes a scheduled hazard multiplier rule for an event. */
  deleteHazardMultiplier: (eventId: string, ruleId: string) =>
    `/admin/events/${eventId}/hazard-multipliers/${ruleId}`,
  /** Returns the admin QR inventory for an event. */
  listAdminQRCodes: (eventId: string) => `/admin/events/${eventId}/qr-codes`,
  /** Creates a new QR inventory entry for an event and generates an asset. */
  createAdminQRCode: (eventId: string) => `/admin/events/${eventId}/qr-codes`,
  /** Updates active/disabled status on an event QR code. */
  setAdminQRCodeStatus: (eventId: string, qrCodeId: string) =>
    `/admin/events/${eventId}/qr-codes/${qrCodeId}/status`,
  /** Soft-deletes an event QR code from active inventory. */
  deleteAdminQRCode: (eventId: string, qrCodeId: string) =>
    `/admin/events/${eventId}/qr-codes/${qrCodeId}`,
  /** Toggles HELIOS (staff) privileges for a given user account. */
  updateHeliosRole: (userId: string) => `/admin/users/${userId}/helios-role`,
  /** Canonical endpoint for updating account capabilities. */
  updateUserCapabilities: (userId: string) => `/admin/users/${userId}/capabilities`,
  /** Retrieves the centralized log of all administrative actions taken during the event. */
  listAuditEntries: (eventId: string) => `/admin/events/${eventId}/audits`,
};

/**
 * Authentication and Login-flow endpoints supporting Auth.js and Email Magic Links.
 */
export const authEndpoints = {
  /** Triggers a SendGrid email dispatch with a magic login link. */
  requestMagicLink: '/auth/magic-link/request',
  /** Exchanges a magic link token for a persistent JWT/cookie session. */
  verifyMagicLink: '/auth/magic-link/verify',
  /** Determines the deeply nested session state (is player assigned? is admin?). */
  getSession: '/auth/session',
  /** Advises the frontend router on exactly which app view to display to the user. */
  getRoutingDecision: '/auth/routing-decision',
  /** Invalidates the active token and logs the user out. */
  logout: '/auth/logout',
};

/**
 * Endpoints for the Helios Superpower QR identity surface.
 * Restricted to authenticated Helios users only.
 */
export const heliosEndpoints = {
  /** Retrieves the active identity-bound Superpower QR asset for a Helios player. */
  getSuperpowerQr: (playerId: string) => `/players/${playerId}/superpower-qr`,
  /** Revokes the current Superpower QR and issues a fresh identity-bound replacement. */
  regenerateSuperpowerQr: (playerId: string) => `/players/${playerId}/superpower-qr/regenerate`,
};

// ============================================================================
// Legacy Aliases
// Retained for backward-compatability with older callers. Treat as deprecrated.
// ============================================================================

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
