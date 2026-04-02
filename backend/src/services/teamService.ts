import type {
  CreateTeamRequest,
  JoinTeamRequest,
  PlayerProfile,
  Team,
} from '../contracts/domain.js';

import { createIsoDate, placeholderPlayer, placeholderTeam } from './placeholderData.js';

export function createTeam(request: CreateTeamRequest): Team {
  // TODO: Save team to database and generate real ID
  return {
    id: 'team-generated-placeholder',
    name: request.name,
    eventId: request.eventId,
    members: [],
    score: 0,
  };
}

export function getTeam(teamId: string): Team {
  // TODO: Query team from database
  return {
    ...placeholderTeam,
    id: teamId,
  };
}

export function joinTeam(teamId: string, request: JoinTeamRequest): Team {
  // TODO: Persist team membership to database
  return {
    ...placeholderTeam,
    id: teamId,
    members: [...placeholderTeam.members, request.playerId],
  };
}

export function getTeamMembers(teamId: string): PlayerProfile[] {
  // TODO: Query team members from database
  return [
    {
      ...placeholderPlayer,
      id: `${teamId}-captain`,
      createdAt: createIsoDate(-45),
    },
  ];
}
