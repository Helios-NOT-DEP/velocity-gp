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
  readonly qrImageUrl: string | null;
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
  readonly label: string;
  readonly value: number;
  readonly zone?: string;
  readonly activationStartsAt?: string;
  readonly activationEndsAt?: string;
  readonly hazardRatioOverride?: number | null;
  readonly hazardWeightOverride?: number | null;
}

/**
 * Response payload returned after creating a new QR code in an event inventory.
 */
export interface CreateQRCodeResponse {
  readonly eventId: string;
  readonly qrCode: QRCodeSummary;
  readonly auditId: string;
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
  readonly auditId: string;
}

/**
 * Response payload for soft-deleting a QR code from active inventory.
 */
export interface DeleteQRCodeResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly deletedAt: string;
  readonly auditId: string;
}

/**
 * Specialized telemetry update allowing administrators to override
 * the mathematical likelihood of a specific QR code inflicting a Pit Penalty.
 */
export interface UpdateQrHazardRandomizerRequest {
  readonly hazardRatioOverride?: number | null;
  readonly hazardWeightOverride?: number | null;
}

/**
 * Confirms the weight adjustment was applied, supplying an audit trace identifier.
 */
export interface UpdateQrHazardRandomizerResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly hazardRatioOverride: number | null;
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

export interface QrImportRowInput {
  readonly label: string;
  readonly value: number;
  readonly zone?: string | null;
  readonly activationStartsAt?: string | null;
  readonly activationEndsAt?: string | null;
  readonly hazardRatioOverride?: number | null;
  readonly hazardWeightOverride?: number | null;
}

export type QrImportAction = 'create' | 'invalid' | 'unchanged';

export interface QrImportPreviewRequest {
  readonly rows: readonly QrImportRowInput[];
}

export interface QrImportPreviewRow {
  readonly rowNumber: number;
  readonly label: string;
  readonly value: number;
  readonly zone: string | null;
  readonly activationStartsAt: string | null;
  readonly activationEndsAt: string | null;
  readonly hazardRatioOverride: number | null;
  readonly hazardWeightOverride: number | null;
  readonly action: QrImportAction;
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly existingQrCodeId: string | null;
}

export interface QrImportPreviewSummary {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly create: number;
  readonly unchanged: number;
}

export interface QrImportPreviewResponse {
  readonly rows: readonly QrImportPreviewRow[];
  readonly summary: QrImportPreviewSummary;
}

export interface QrImportApplyRequest {
  readonly rows: readonly QrImportRowInput[];
}

export interface QrImportApplySummary {
  readonly total: number;
  readonly processed: number;
  readonly invalid: number;
  readonly created: number;
  readonly unchanged: number;
}

export interface QrImportApplyResponse {
  readonly rows: readonly QrImportPreviewRow[];
  readonly summary: QrImportApplySummary;
  readonly createdQrCodeIds: readonly string[];
  readonly auditId: string;
}

export interface ExportQrAssetsRequest {
  readonly qrCodeIds?: readonly string[];
}

export interface ExportQrAssetsResponse {
  readonly eventId: string;
  readonly fileName: string;
  readonly mimeType: 'application/zip';
  readonly archiveBase64: string;
  readonly included: number;
  readonly failed: number;
}

/**
 * Semantic alias denoting that a QR Code itself functions interchangeably
 * as the delivery mechanism for a Hazard.
 */
export type Hazard = QRCodeSummary;
