import type {
  HeliosRescueFlow,
  InitiateRescueRequest,
  RescueCompletionResponse,
} from '../contracts/domain.js';

import { createIsoDate, placeholderEvent, placeholderPlayer } from './placeholderData.js';

export function initiateRescue(request: InitiateRescueRequest): HeliosRescueFlow {
  return {
    playerId: request.playerId,
    eventId: request.eventId,
    initiatedAt: createIsoDate(2),
    status: 'REQUESTED',
  };
}

export function getRescueStatus(playerId: string): HeliosRescueFlow {
  return {
    playerId,
    eventId: placeholderEvent.id,
    initiatedAt: createIsoDate(-12),
    status: playerId === placeholderPlayer.id ? 'IN_PROGRESS' : 'REQUESTED',
  };
}

export function completeRescue(playerId: string): RescueCompletionResponse {
  return {
    playerId,
    completedAt: createIsoDate(15),
    status: 'COMPLETED',
  };
}
