import type { Hazard, ScanHazardRequest, ScanHazardResponse } from '@velocity-gp/api-contract';

import { prisma } from '../db/client.js';
import { placeholderQRCodes } from './placeholderData.js';
import { submitLegacyScan } from './scanService.js';

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

export async function scanHazard(request: ScanHazardRequest): Promise<ScanHazardResponse> {
  return submitLegacyScan(request);
}

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
