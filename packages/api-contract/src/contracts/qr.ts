export type QRCodeStatus = 'ACTIVE' | 'DISABLED';

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

export interface SetQRCodeStatusRequest {
  readonly status: QRCodeStatus;
  readonly reason?: string;
}

export interface SetQRCodeStatusResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly status: QRCodeStatus;
  readonly updatedAt: string;
}

export interface UpdateQrHazardRandomizerRequest {
  readonly hazardWeightOverride: number | null;
}

export interface UpdateQrHazardRandomizerResponse {
  readonly eventId: string;
  readonly qrCodeId: string;
  readonly hazardWeightOverride: number | null;
  readonly updatedAt: string;
  readonly auditId: string;
}

export interface ListEventQRCodesResponse {
  readonly eventId: string;
  readonly qrCodes: QRCodeSummary[];
}

export type Hazard = QRCodeSummary;
