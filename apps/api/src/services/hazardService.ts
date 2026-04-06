import type { Hazard, ScanHazardRequest, ScanHazardResponse } from '@velocity-gp/api-contract';

import { placeholderQRCodes } from './placeholderData.js';
import { submitLegacyScan } from './scanService.js';

export function scanHazard(request: ScanHazardRequest): ScanHazardResponse {
  return submitLegacyScan(request);
}

export function getHazard(hazardId: string): Hazard {
  const qrCode =
    placeholderQRCodes.find((candidate) => candidate.id === hazardId) ?? placeholderQRCodes[0];

  return {
    ...qrCode,
    id: hazardId,
  };
}

export function listHazards(eventId: string): Hazard[] {
  return placeholderQRCodes.map((qrCode) => ({
    ...qrCode,
    eventId,
  }));
}
