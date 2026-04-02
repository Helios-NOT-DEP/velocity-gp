import type { Hazard, ScanHazardRequest, ScanHazardResponse } from '../contracts/domain.js';

import { createIsoDate, placeholderHazards } from './placeholderData.js';

export function scanHazard(request: ScanHazardRequest): ScanHazardResponse {
  // TODO: Verify QR code and query hazard from database
  return {
    hazardId: placeholderHazards[0].id,
    playerId: request.playerId,
    eventId: request.eventId,
    recognized: request.qrCode.length > 0,
    scannedAt: createIsoDate(3),
  };
}

export function getHazard(hazardId: string): Hazard {
  // TODO: Query hazard from database
  return {
    ...placeholderHazards[0],
    id: hazardId,
  };
}

export function listHazards(eventId: string): Hazard[] {
  // TODO: Query hazards for event from database
  return placeholderHazards.map((hazard) => ({
    ...hazard,
    eventId,
  }));
}
