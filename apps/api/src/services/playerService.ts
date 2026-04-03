import type {
  CreatePlayerRequest,
  PlayerProfile,
  UpdatePlayerRequest,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderPlayer } from './placeholderData.js';

export function createPlayer(request: CreatePlayerRequest): PlayerProfile {
  // TODO: Save player to database and generate real ID
  return {
    id: 'player-generated-placeholder',
    email: request.email,
    name: request.name,
    eventId: request.eventId,
    createdAt: createIsoDate(1),
  };
}

export function getPlayerProfile(playerId: string): PlayerProfile {
  // TODO: Query player profile from database
  return {
    ...placeholderPlayer,
    id: playerId,
  };
}

export function updatePlayerProfile(playerId: string, request: UpdatePlayerRequest): PlayerProfile {
  // TODO: Persist player profile updates to database
  return {
    ...placeholderPlayer,
    id: playerId,
    name: request.name ?? placeholderPlayer.name,
  };
}
