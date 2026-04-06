import type {
  CreateTeamRequest,
  JoinTeamRequest,
  PlayerProfile,
  Team,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderPlayer, placeholderTeam, withTeamStatus } from './placeholderData.js';

export function createTeam(request: CreateTeamRequest): Team {
  return {
    id: 'team-generated-placeholder',
    name: request.name,
    eventId: request.eventId,
    status: 'PENDING',
    pitStopExpiresAt: null,
    members: [],
    score: 0,
  };
}

export function getTeam(teamId: string): Team {
  return {
    ...placeholderTeam,
    id: teamId,
  };
}

export function joinTeam(teamId: string, request: JoinTeamRequest): Team {
  return {
    ...withTeamStatus(placeholderTeam, 'ACTIVE', null),
    id: teamId,
    members: [...placeholderTeam.members, request.playerId],
  };
}

export function getTeamMembers(teamId: string): PlayerProfile[] {
  return [
    {
      ...placeholderPlayer,
      id: `${teamId}-captain`,
      createdAt: createIsoDate(-45),
    },
  ];
}
