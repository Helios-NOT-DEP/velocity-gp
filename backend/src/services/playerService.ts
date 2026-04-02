import type {
  CreatePlayerRequest,
  PlayerProfile,
  UpdatePlayerRequest,
} from '../contracts/domain.js';

import { createIsoDate, placeholderPlayer } from './placeholderData.js';

export function createPlayer(request: CreatePlayerRequest): PlayerProfile {
  return {
    id: 'player-generated-placeholder',
    email: request.email,
    name: request.name,
    eventId: request.eventId,
    createdAt: createIsoDate(1),
  };
}

export function getPlayerProfile(playerId: string): PlayerProfile {
  return {
    ...placeholderPlayer,
    id: playerId,
  };
}

export function updatePlayerProfile(playerId: string, request: UpdatePlayerRequest): PlayerProfile {
  return {
    ...placeholderPlayer,
    id: playerId,
    name: request.name ?? placeholderPlayer.name,
  };
}
