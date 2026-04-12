import type {
  JoinTeamRequest,
  PlayerProfile,
  Team,
} from '@velocity-gp/api-contract';

import {
  createIsoDate,
  placeholderPlayer,
  placeholderTeam,
  withTeamStatus,
} from './placeholderData.js';

/**
 * Team service used by route handlers for team lifecycle operations.
 *
 * This module currently provides placeholder implementations while team
 * persistence and mutation flows are migrated to Prisma-backed services.
 */
export function createTeam(request: { teamname: string }): Team {
  return {
    id: 'team-generated-placeholder',
    name: request.teamname,
    eventId: '',
    status: 'PENDING',
    pitStopExpiresAt: null,
    members: [],
    score: 0
  };
}

/**
 * Loads a single team by ID.
 *
 * Current behavior clones placeholder team data and replaces the ID.
 */
export function getTeam(teamId: string): Team {
  return {
    ...placeholderTeam,
    id: teamId,
  };
}

/**
 * Adds a player to the team roster and ensures the team is active.
 *
 * Current behavior is placeholder-only and not persisted.
 */
export function joinTeam(teamId: string, request: JoinTeamRequest): Team {
  return {
    ...withTeamStatus(placeholderTeam, 'ACTIVE', null),
    id: teamId,
    members: [...placeholderTeam.members, request.playerId],
  };
}

/**
 * Returns team members for display in team profile screens.
 *
 * Placeholder data includes a synthetic captain profile for the requested team.
 */
export function getTeamMembers(teamId: string): PlayerProfile[] {
  return [
    {
      ...placeholderPlayer,
      id: `${teamId}-captain`,
      createdAt: createIsoDate(-45),
    },
  ];
}
