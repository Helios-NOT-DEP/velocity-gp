import type { Hazard, ScanHazardRequest, ScanHazardResponse } from '@velocity-gp/api-contract';

import { prisma } from '../db/client.js';
import { placeholderQRCodes } from './placeholderData.js';
import { submitLegacyScan } from './scanService.js';

/**
 * Hazard service for QR-code hazards used by admin and player APIs.
 *
 * Reads from Prisma when records exist and falls back to deterministic placeholder
 * data during early-stage or empty-state workflows.
 */
function toHazardRecord(hazard: {
  id: string;
  eventId: string;
  label: string;
  value: number;
  zone: string | null;
  payload: string;
  status: 'ACTIVE' | 'DISABLED';
  scanCount: number;
  hazardRatioOverride: number | null;
  hazardWeightOverride: number | null;
  activationStartsAt: Date | null;
  activationEndsAt: Date | null;
}): Hazard {
  return {
    ...hazard,
    activationStartsAt: hazard.activationStartsAt?.toISOString() ?? null,
    activationEndsAt: hazard.activationEndsAt?.toISOString() ?? null,
  };
}

/**
 * Legacy scan endpoint adapter.
 *
 * Delegates to the new scan service while preserving legacy request/response shape.
 */
export async function scanHazard(request: ScanHazardRequest): Promise<ScanHazardResponse> {
  return submitLegacyScan(request);
}

/**
 * Loads a single hazard by ID.
 *
 * Falls back to placeholder data when a persisted record is not found.
 */
export async function getHazard(hazardId: string): Promise<Hazard> {
  const qrCode = await prisma.qRCode.findUnique({
    where: {
      id: hazardId,
    },
    select: {
      id: true,
      eventId: true,
      label: true,
      value: true,
      zone: true,
      payload: true,
      status: true,
      scanCount: true,
      hazardRatioOverride: true,
      hazardWeightOverride: true,
      activationStartsAt: true,
      activationEndsAt: true,
    },
  });

  if (qrCode) {
    return toHazardRecord(qrCode);
  }

  const placeholder = placeholderQRCodes[0];
  if (!placeholder) {
    throw new Error('No hazard records available.');
  }

  return {
    ...placeholder,
    id: hazardId,
  };
}

/**
 * Lists hazards for an event, ordered by label.
 *
 * Returns placeholder hazards scoped to the requested event when none are persisted.
 */
export async function listHazards(eventId: string): Promise<Hazard[]> {
  const qrCodes = await prisma.qRCode.findMany({
    where: {
      eventId,
    },
    orderBy: {
      label: 'asc',
    },
    select: {
      id: true,
      eventId: true,
      label: true,
      value: true,
      zone: true,
      payload: true,
      status: true,
      scanCount: true,
      hazardRatioOverride: true,
      hazardWeightOverride: true,
      activationStartsAt: true,
      activationEndsAt: true,
    },
  });

  if (qrCodes.length > 0) {
    return qrCodes.map(toHazardRecord);
  }

  return placeholderQRCodes.map((qrCode) => ({
    ...qrCode,
    eventId,
  }));
}
