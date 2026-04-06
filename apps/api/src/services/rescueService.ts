import type {
  HeliosRescueFlow,
  InitiateRescueRequest,
  RescueCompletionResponse,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderEvent, placeholderRescue } from './placeholderData.js';

export function initiateRescue(request: InitiateRescueRequest): HeliosRescueFlow {
  return {
    id: 'rescue-requested-placeholder',
    playerId: request.playerId,
    eventId: request.eventId,
    rescuerUserId: request.heliosQrId ?? placeholderRescue.rescuerUserId,
    initiatedAt: createIsoDate(2),
    completedAt: null,
    status: 'REQUESTED',
  };
}

export function getRescueStatus(playerId: string): HeliosRescueFlow {
  return {
    ...placeholderRescue,
    playerId,
    eventId: placeholderEvent.id,
    status: playerId === placeholderRescue.playerId ? 'COMPLETED' : 'IN_PROGRESS',
  };
}

export function completeRescue(playerId: string): RescueCompletionResponse {
  return {
    playerId,
    completedAt: createIsoDate(15),
    status: 'COMPLETED',
  };
}
