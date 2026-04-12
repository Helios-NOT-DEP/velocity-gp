/**
 * @file scans.ts
 * @description Outlines the mechanics and logic payloads involved heavily in QR Scanning.
 * Scanning bridges the physical gap in Velocity GP, handling everything from gaining points
 * to getting caught in "pits". Here the structured response outcomes denote exactly
 * what the server mathematically derived from a user's scan sequence.
 */

/** Possible macroscopic conclusions returned after processing a QR code submission. */
export type ScanOutcome = 'SAFE' | 'HAZARD_PIT' | 'INVALID' | 'DUPLICATE' | 'BLOCKED';

/**
 * Normalized machine-readable keys explicitly indicating why a scan failed or was blocked.
 */
export type StableErrorCode =
  | 'SELF_RESCUE_FORBIDDEN'
  | 'RACE_PAUSED'
  | 'QR_DISABLED'
  | 'QR_NOT_FOUND'
  | 'ALREADY_CLAIMED'
  | 'TEAM_IN_PIT'
  | 'HELIOS_COOLDOWN_ACTIVE'
  | 'NO_ACTIVE_PIT';

/**
 * Baseline payload fired by a client's camera/scanner logic containing
 * the scanned QR content strings.
 */
export interface SubmitScanRequest {
  readonly playerId: string;
  readonly qrPayload: string;
}

/**
 * Inherited root containing identical metadata attached regardless of how a scan evaluated.
 */
export interface ScanResultBase {
  readonly outcome: ScanOutcome;
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string | null;
  readonly qrCodeId: string | null;
  readonly qrPayload: string;
  readonly scannedAt: string;
  readonly message: string;
}

/**
 * The optimal scan flow: Represents a QR code captured that successfully accumulated
 * standard logic points devoid of any Pit constraint consequences.
 */
export interface SafeScanResult extends ScanResultBase {
  readonly outcome: 'SAFE';
  readonly pointsAwarded: number;
  readonly teamScore: number;
  readonly claimCreated: true;
  readonly hazardRatioUsed: number;
}

/**
 * The 'trap' outcome: The player's QR scan triggered an RNG check resulting in
 * their entire team moving into a timed PIT state (Penalty).
 */
export interface HazardPitScanResult extends ScanResultBase {
  readonly outcome: 'HAZARD_PIT';
  readonly pointsAwarded: 0;
  readonly teamScore: number;
  readonly pitStopExpiresAt: string;
  readonly hazardRatioUsed: number;
}

/**
 * Denotes a QR code inherently non-functional or unrecognizable by the game server.
 * The penalty is applied to the team's score and reflected in `teamScore`.
 */
export interface InvalidScanResult extends ScanResultBase {
  readonly outcome: 'INVALID';
  readonly pointsAwarded: number;
  readonly teamScore: number;
  readonly errorCode: Extract<StableErrorCode, 'QR_NOT_FOUND'>;
  readonly flaggedForReview: boolean;
}

/**
 * Evaluated whenever an already-registered code is pinged again by the same player/team.
 */
export interface DuplicateScanResult extends ScanResultBase {
  readonly outcome: 'DUPLICATE';
  readonly pointsAwarded: 0;
  readonly errorCode: Extract<StableErrorCode, 'ALREADY_CLAIMED'>;
}

/**
 * Identifies edge-case systemic issues (Admin pauses, Player already inside Pit)
 * preventing an otherwise normal code from working.
 */
export interface BlockedScanResult extends ScanResultBase {
  readonly outcome: 'BLOCKED';
  readonly pointsAwarded: 0;
  readonly errorCode:
    | Extract<StableErrorCode, 'QR_DISABLED'>
    | Extract<StableErrorCode, 'RACE_PAUSED'>
    | Extract<StableErrorCode, 'TEAM_IN_PIT'>;
}

/**
 * Strongly typed union defining every distinct object permutation an API caller
 * will encounter as a serialized JSON blob upon evaluating `submitScan`.
 */
export type SubmitScanResponse =
  | SafeScanResult
  | HazardPitScanResult
  | InvalidScanResult
  | DuplicateScanResult
  | BlockedScanResult;

/** Legacy fallback interface for legacy endpoints handling scanner events. */
export interface ScanHazardRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly qrCode: string;
}

/** Legacy response type mimicking the unified Response pattern. */
export type ScanHazardResponse = SubmitScanResponse;

/** Request definition for updating a specific resolved hazard interaction. */
export interface HazardStatusUpdateRequest {
  readonly hazardId: string;
  readonly status: 'ENCOUNTERED' | 'RESOLVED';
}

/** Acknowledged state payload mirroring the completed Hazard Status Update context. */
export interface HazardStatusUpdateResponse extends HazardStatusUpdateRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly updatedAt: string;
}
