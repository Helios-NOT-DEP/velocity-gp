/**
 * @file participants.ts
 * @description A comprehensive domain registry describing core real-world concepts in the game.
 * Outlines defining constraints for Events, Players, Teams, and the cooperative Rescue mechanics,
 * bridging database types and transient API exchange formats.
 */

/** High-level enum mapping macro lifecycles of a racing event. */
export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

/** High-level enum representing a collaborative Squad's activity constraints. */
export type TeamStatus = 'PENDING' | 'ACTIVE' | 'IN_PIT';

/** Specific state of an individual player; generally inherits limits from their bound Team. */
export type PlayerStatus = 'RACING' | 'IN_PIT' | 'FINISHED';

/** Captures the sequential phases of helping a player out of a hazard condition. */
export type RescueStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

/**
 * Compressed, top-level Event descriptor. Typically used when rendering
 * the dashboard listing rather than fully detailed admin screens.
 */
export interface EventSummary {
  readonly id: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: EventStatus;
}

/**
 * Standard unit mapping a discrete row on the active Scoring Board.
 */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly teamId: string;
  readonly teamName: string;
  readonly score: number;
  readonly memberCount: number;
  readonly status: TeamStatus;
  readonly pitStopExpiresAt?: string | null;
}

export const displayEventTypes = [
  'TEAM_ENTERED_PIT',
  'TEAM_EXITED_PIT',
  'TEAM_REPAIRS_COMPLETE',
] as const;

export type DisplayEventType = (typeof displayEventTypes)[number];

export const displayEventReasons = [
  'HAZARD_TRIGGER',
  'TIMER_EXPIRED',
  'ADMIN_MANUAL',
  'RESCUE_CLEARED',
] as const;

export type DisplayEventReason = (typeof displayEventReasons)[number];

export interface DisplayEvent {
  readonly id: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly type: DisplayEventType;
  readonly reason: DisplayEventReason;
  readonly occurredAt: string;
}

export interface ListDisplayEventsQuery {
  readonly since?: string;
  readonly limit?: number;
}

export interface ListDisplayEventsResponse {
  readonly items: readonly DisplayEvent[];
  readonly nextCursor: string | null;
}

/**
 * Request specification for provisioning a basic player profile before fully assigning a team.
 */
export interface CreatePlayerRequest {
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
  readonly teamId?: string;
}

/**
 * Change descriptor for augmenting an active Player, commonly used to bind a team mapping.
 */
export interface UpdatePlayerRequest {
  readonly name?: string;
  readonly teamId?: string | null;
}

/**
 * Rich domain composition defining a Player. Tracks their individual points contribution
 * apart from their team context and handles suspicious activity flagging (`isFlaggedForReview`).
 */
export interface PlayerProfile {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly eventId: string;
  readonly teamId: string | null;
  readonly status: PlayerStatus;
  readonly individualScore: number;
  readonly isFlaggedForReview: boolean;
  readonly joinedAt: string;
  readonly createdAt: string;
}

/**
 * Minimal payload for injecting a new Team identity into an event ecosystem.
 */
export interface CreateTeamRequest {
  readonly name: string;
  readonly eventId: string;
}

/**
 * Intended transition payload to connect an identified player to an allocated Team context.
 */
export interface JoinTeamRequest {
  readonly playerId: string;
}

/**
 * Richly populated entity representing an active Squad of players. Includes aggregated fields
 * like accumulated `score` from all members and penalty locks (`pitStopExpiresAt`).
 */
export interface Team {
  readonly id: string;
  readonly name: string;
  readonly eventId: string;
  readonly status: TeamStatus;
  readonly pitStopExpiresAt: string | null;
  readonly members: string[];
  readonly score: number;
}

/**
 * Payload indicating a player requires external aid to bypass an active penalty structure.
 */
export interface InitiateRescueRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly heliosQrId?: string;
  readonly reason?: string;
}

/**
 * Transactional entity detailing an active attempt to release a Player from 'IN_PIT' limits.
 */
export interface HeliosRescueFlow {
  readonly id: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly rescuerUserId: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly cooldownExpiresAt: string | null;
  readonly status: RescueStatus;
  readonly reason: string | null;
}

/**
 * Query payload for listing rescue history initiated by a specific Helios user.
 */
export interface RescueLogQuery {
  readonly eventId?: string;
  readonly limit?: number;
}

/**
 * Response payload for Helios rescue activity log queries.
 */
export interface RescueLogResponse {
  readonly rescues: readonly HeliosRescueFlow[];
}

/**
 * Returned status payload validating that a rescue workflow was successfully fulfilled.
 */
export interface RescueCompletionResponse {
  readonly playerId: string;
  readonly completedAt: string;
  readonly status: Extract<RescueStatus, 'COMPLETED'>;
}

export interface CreateTeamLogoRequest {
  readonly description: string;
  readonly teamName: string;
}

/**
 * Identity payload vended by the backend directly to the scanner UI.
 * Unifies the distinct database identifiers needed to properly credit
 * a player's QR scan within the currently active event context.
 */
export interface PlayerActiveIdentity {
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: TeamStatus | null;
  readonly pitStopExpiresAt: string | null;
  readonly email: string;
}

/** Lifecycle states for a Helios user's identity-bound Superpower QR asset. */
export type SuperpowerQRAssetStatus = 'ACTIVE' | 'REVOKED';

/**
 * A persistent, identity-bound QR asset issued exclusively to Helios users.
 * Encodes a unique payload that can be scanned to initiate a rescue flow.
 * Only one ACTIVE asset exists per user at any time.
 */
export interface HeliosSuperpowerQRAsset {
  readonly id: string;
  readonly userId: string;
  readonly payload: string;
  readonly qrImageUrl: string;
  readonly status: SuperpowerQRAssetStatus;
  readonly createdAt: string;
  readonly regeneratedAt: string | null;
}

/**
 * Response shape returned when a Helios user fetches their active Superpower QR.
 */
export interface GetSuperpowerQRResponse {
  readonly asset: HeliosSuperpowerQRAsset;
}

/**
 * Response shape returned after a successful Superpower QR regeneration.
 * The previous asset is immediately revoked and replaced.
 */
export interface RegenerateSuperpowerQRResponse {
  readonly asset: HeliosSuperpowerQRAsset;
  readonly revokedAssetId: string | null;
}
