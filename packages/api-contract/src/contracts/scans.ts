export type ScanOutcome = 'SAFE' | 'HAZARD_PIT' | 'INVALID' | 'DUPLICATE' | 'BLOCKED';

export type StableErrorCode =
  | 'SELF_RESCUE_FORBIDDEN'
  | 'RACE_PAUSED'
  | 'QR_DISABLED'
  | 'QR_NOT_FOUND'
  | 'ALREADY_CLAIMED'
  | 'TEAM_IN_PIT'
  | 'HELIOS_COOLDOWN_ACTIVE'
  | 'NO_ACTIVE_PIT';

export interface SubmitScanRequest {
  readonly playerId: string;
  readonly qrPayload: string;
}

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

export interface SafeScanResult extends ScanResultBase {
  readonly outcome: 'SAFE';
  readonly pointsAwarded: number;
  readonly teamScore: number;
  readonly claimCreated: true;
  readonly hazardRatioUsed: number;
}

export interface HazardPitScanResult extends ScanResultBase {
  readonly outcome: 'HAZARD_PIT';
  readonly pointsAwarded: 0;
  readonly teamScore: number;
  readonly pitStopExpiresAt: string;
  readonly hazardRatioUsed: number;
}

export interface InvalidScanResult extends ScanResultBase {
  readonly outcome: 'INVALID';
  readonly pointsAwarded: number;
  readonly errorCode: Extract<StableErrorCode, 'QR_NOT_FOUND'>;
  readonly flaggedForReview: boolean;
}

export interface DuplicateScanResult extends ScanResultBase {
  readonly outcome: 'DUPLICATE';
  readonly pointsAwarded: 0;
  readonly errorCode: Extract<StableErrorCode, 'ALREADY_CLAIMED'>;
}

export interface BlockedScanResult extends ScanResultBase {
  readonly outcome: 'BLOCKED';
  readonly pointsAwarded: 0;
  readonly errorCode:
    | Extract<StableErrorCode, 'QR_DISABLED'>
    | Extract<StableErrorCode, 'RACE_PAUSED'>
    | Extract<StableErrorCode, 'TEAM_IN_PIT'>;
}

export type SubmitScanResponse =
  | SafeScanResult
  | HazardPitScanResult
  | InvalidScanResult
  | DuplicateScanResult
  | BlockedScanResult;

export interface ScanHazardRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly qrCode: string;
}

export type ScanHazardResponse = SubmitScanResponse;

export interface HazardStatusUpdateRequest {
  readonly hazardId: string;
  readonly status: 'ENCOUNTERED' | 'RESOLVED';
}

export interface HazardStatusUpdateResponse extends HazardStatusUpdateRequest {
  readonly playerId: string;
  readonly eventId: string;
  readonly updatedAt: string;
}
