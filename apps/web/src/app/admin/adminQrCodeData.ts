import type { QRCodeSummary } from '@/services/api';
import type { AdminQrCode } from './adminViewData';

export function toAdminQrCode(qrCode: QRCodeSummary): AdminQrCode {
  return {
    id: qrCode.id,
    name: qrCode.label,
    points: qrCode.value,
    zone: qrCode.zone,
    payload: qrCode.payload,
    qrImageUrl: qrCode.qrImageUrl,
    active: qrCode.status === 'ACTIVE',
    scanCount: qrCode.scanCount,
    hazardRatioOverride: qrCode.hazardRatioOverride,
    hazardWeightOverride: qrCode.hazardWeightOverride,
    activationStartsAt: qrCode.activationStartsAt,
    activationEndsAt: qrCode.activationEndsAt,
  };
}

function parseDateToEpoch(dateValue: string | null): number | null {
  if (!dateValue) {
    return null;
  }

  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

export function isAdminQrCodeActiveNow(
  qrCode: Pick<AdminQrCode, 'active' | 'activationStartsAt' | 'activationEndsAt'>,
  now: Date = new Date()
): boolean {
  if (!qrCode.active) {
    return false;
  }

  const nowMs = now.getTime();
  const startMs = parseDateToEpoch(qrCode.activationStartsAt);
  const endMs = parseDateToEpoch(qrCode.activationEndsAt);

  if (qrCode.activationStartsAt && startMs === null) {
    return false;
  }

  if (qrCode.activationEndsAt && endMs === null) {
    return false;
  }

  if (startMs !== null && startMs > nowMs) {
    return false;
  }

  if (endMs !== null && endMs <= nowMs) {
    return false;
  }

  return true;
}
