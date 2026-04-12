import type {
  CreatePlayerRequest,
  PlayerProfile,
  UpdatePlayerRequest,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderPlayer } from './placeholderData.js';

/**
 * Player profile service used by player-centric API endpoints.
 *
 * This module currently returns placeholder-backed player records until full
 * database-backed CRUD flows are added.
 */
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

/**
 * Returns a single player profile by ID.
 *
 * Current behavior reuses placeholder data and swaps only the player ID.
 */
export function getPlayerProfile(playerId: string): PlayerProfile {
  return {
    ...placeholderPlayer,
    id: playerId,
  };
}

/**
 * Updates mutable profile fields for a player.
 *
 * Current behavior applies updates against placeholder data only.
 */
export function updatePlayerProfile(playerId: string, request: UpdatePlayerRequest): PlayerProfile {
  return {
    ...placeholderPlayer,
    id: playerId,
    name: request.name ?? placeholderPlayer.name,
    teamId: request.teamId === undefined ? placeholderPlayer.teamId : request.teamId,
  };
}
