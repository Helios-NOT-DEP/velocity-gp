/**
 * @file qr.ts
 * @description Data structures specifically modeling physical QR codes placed in the real world
 * and their corresponding virtual representation. Covers QR Code metadata, hazard injection
 * probability tuning, and standard summary schemas.
 */

/** Reflects whether a deployed QR code should be accepted or temporarily retired by the scanner. */
export type QRCodeStatus = 'ACTIVE' | 'DISABLED';

/**
 * Standard summary of a single QR code loaded in memory or queried from DB.
 * Tracks critical game logic modifiers ranging from the dynamic `hazardRatioOverride`
 * to timed-activations (`activationStartsAt`).
 */
export interface QRCodeSummary {
  readonly id: string;
  readonly eventId: string;
  readonly label: string;
  readonly value: number;
  readonly zone: string | null;
  readonly payload: string;
  readonly status: QRCodeStatus;
  readonly scanCount: number;
  readonly hazardRatioOverride: number | null;
  readonly hazardWeightOverride: number | null;
  readonly activationStartsAt: string | null;
  readonly activationEndsAt: string | null;
}

/**
 * Payload to bootstrap a new QR Code into an active Event's lookup pool.
 */
export interface CreateQRCodeRequest {
  readonly eventId: string;
  readonly label: string;
  readonly value: number;
  readonly payload: string;
  readonly zone?: string;
  readonly activationStartsAt?: string;
  readonly activationEndsAt?: string;
  readonly hazardRatioOverride?: number;
  readonly hazardWeightOverride?: number | null;
}

/**
 * Payload authorizing the toggle state of an existing QR Code (e.g. retiring it mid-game).
 */
export interface SetQRCodeStatusRequest {
  readonly status: QRCodeStatus;
  readonly reason?: string;
}

/**
 * Confirms that a QR Code's operational state was updated successfully.
 */
export interface SetQRCodeStatusResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly status: QRCodeStatus;
  readonly updatedAt: string;
}

/**
 * Specialized telemetry update allowing administrators to override
 * the mathematical likelihood of a specific QR code inflicting a Pit Penalty.
 */
export interface UpdateQrHazardRandomizerRequest {
  readonly hazardWeightOverride: number | null;
}

/**
 * Confirms the weight adjustment was applied, supplying an audit trace identifier.
 */
export interface UpdateQrHazardRandomizerResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly hazardWeightOverride: number | null;
  readonly updatedAt: string;
  readonly auditId: string;
}

/**
 * Aggregate summary encapsulating an entire batch array of provisioned QR Codes.
 */
export interface ListEventQRCodesResponse {
  readonly eventId: string;
  readonly qrCodes: QRCodeSummary[];
}

/**
 * Semantic alias denoting that a QR Code itself functions interchangeably
 * as the delivery mechanism for a Hazard.
 */
export type Hazard = QRCodeSummary;
