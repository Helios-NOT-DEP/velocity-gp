import type {
  CreateTeamRequest,
  JoinTeamRequest,
  PlayerProfile,
  Team,
} from '../contracts/domain.js';

import { createIsoDate, placeholderPlayer, placeholderTeam } from './placeholderData.js';

export function createTeam(request: CreateTeamRequest): Team {
  return {
    id: 'team-generated-placeholder',
    name: request.name,
    eventId: request.eventId,
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
    ...placeholderTeam,
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
