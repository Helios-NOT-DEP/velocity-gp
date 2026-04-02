import type {
  Hazard,
  ScanHazardRequest,
  ScanHazardResponse,
} from '../contracts/domain.js';

import { createIsoDate, placeholderHazards } from './placeholderData.js';

export function scanHazard(request: ScanHazardRequest): ScanHazardResponse {
  return {
    hazardId: placeholderHazards[0].id,
    playerId: request.playerId,
    eventId: request.eventId,
    recognized: request.qrCode.length > 0,
    scannedAt: createIsoDate(3),
  };
}

export function getHazard(hazardId: string): Hazard {
  return {
    ...placeholderHazards[0],
    id: hazardId,
  };
}

export function listHazards(eventId: string): Hazard[] {
  return placeholderHazards.map((hazard) => ({
    ...hazard,
    eventId,
  }));
}
