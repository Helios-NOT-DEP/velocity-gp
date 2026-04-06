import type {
  CreatePlayerRequest,
  PlayerProfile,
  UpdatePlayerRequest,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderPlayer } from './placeholderData.js';

export function createPlayer(request: CreatePlayerRequest): PlayerProfile {
  return {
    ...placeholderPlayer,
    id: 'player-generated-placeholder',
    userId: 'user-generated-placeholder',
    email: request.email,
    name: request.name,
    eventId: request.eventId,
    teamId: request.teamId ?? null,
    joinedAt: createIsoDate(1),
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
    teamId: request.teamId === undefined ? placeholderPlayer.teamId : request.teamId,
  };
}
