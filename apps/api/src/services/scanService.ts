import type {
  ScanHazardRequest,
  SubmitScanRequest,
  SubmitScanResponse,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderQRCodes, placeholderTeam } from './placeholderData.js';

interface SubmitScanInput {
  readonly eventId: string;
  readonly request: SubmitScanRequest;
}

export function submitScan(input: SubmitScanInput): SubmitScanResponse {
  const qrPayload = input.request.qrPayload.trim();
  const qrCode = placeholderQRCodes.find((candidate) => candidate.payload === qrPayload) ?? null;

  if (!qrCode) {
    return {
      outcome: 'INVALID',
      eventId: input.eventId,
      playerId: input.request.playerId,
      teamId: null,
      qrCodeId: null,
      qrPayload,
      scannedAt: createIsoDate(3),
      message: 'QR payload is not recognized.',
      pointsAwarded: -1,
      errorCode: 'QR_NOT_FOUND',
      flaggedForReview: true,
    };
  }

  if (qrCode.status === 'DISABLED') {
    return {
      outcome: 'BLOCKED',
      eventId: input.eventId,
      playerId: input.request.playerId,
      teamId: placeholderTeam.id,
      qrCodeId: qrCode.id,
      qrPayload,
      scannedAt: createIsoDate(3),
      message: 'QR code is disabled by admin control.',
      pointsAwarded: 0,
      errorCode: 'QR_DISABLED',
    };
  }

  if (qrPayload.includes('ALPHA')) {
    return {
      outcome: 'HAZARD_PIT',
      eventId: input.eventId,
      playerId: input.request.playerId,
      teamId: placeholderTeam.id,
      qrCodeId: qrCode.id,
      qrPayload,
      scannedAt: createIsoDate(3),
      message: 'Hazard trigger reached. Team moved to pit stop.',
      pointsAwarded: 0,
      teamScore: placeholderTeam.score,
      pitStopExpiresAt: createIsoDate(18),
      hazardRatioUsed: qrCode.hazardRatioOverride ?? 15,
    };
  }

  if (qrPayload.includes('BETA')) {
    return {
      outcome: 'DUPLICATE',
      eventId: input.eventId,
      playerId: input.request.playerId,
      teamId: placeholderTeam.id,
      qrCodeId: qrCode.id,
      qrPayload,
      scannedAt: createIsoDate(3),
      message: 'Player has already claimed this QR code.',
      pointsAwarded: 0,
      errorCode: 'ALREADY_CLAIMED',
    };
  }

  return {
    outcome: 'SAFE',
    eventId: input.eventId,
    playerId: input.request.playerId,
    teamId: placeholderTeam.id,
    qrCodeId: qrCode.id,
    qrPayload,
    scannedAt: createIsoDate(3),
    message: 'Safe scan awarded points.',
    pointsAwarded: qrCode.value,
    teamScore: placeholderTeam.score + qrCode.value,
    claimCreated: true,
    hazardRatioUsed: qrCode.hazardRatioOverride ?? 15,
  };
}

export function submitLegacyScan(request: ScanHazardRequest): SubmitScanResponse {
  return submitScan({
    eventId: request.eventId,
    request: {
      playerId: request.playerId,
      qrPayload: request.qrCode,
    },
  });
}
