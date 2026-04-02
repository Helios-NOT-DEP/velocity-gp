import type {
  GetRaceStateResponse,
  HazardStatusUpdateRequest,
  HazardStatusUpdateResponse,
  LeaderboardEntry,
} from '../contracts/domain.js';

import { createIsoDate, placeholderPlayer, placeholderTeam } from './placeholderData.js';

export function getRaceState(eventId: string, playerId: string): GetRaceStateResponse {
  // TODO: Query real race state from database
  return {
    playerId,
    eventId,
    currentLocation: 'PIT_LANE_ALPHA',
    teamId: placeholderTeam.id,
    hazardsEncountered: ['hazard-001', 'hazard-002'],
    score: 860,
    status: playerId === placeholderPlayer.id ? 'IN_PIT' : 'RACING',
  };
}

export function updateHazardStatus(
  eventId: string,
  playerId: string,
  request: HazardStatusUpdateRequest
): HazardStatusUpdateResponse {
  // TODO: Persist hazard status update to database
  return {
    eventId,
    playerId,
    hazardId: request.hazardId,
    status: request.status,
    updatedAt: createIsoDate(5),
  };
}

export function getLeaderboard(eventId: string): LeaderboardEntry[] {
  // TODO: Query real leaderboard data from database
  return [
    {
      rank: 1,
      teamId: placeholderTeam.id,
      teamName: placeholderTeam.name,
      score: placeholderTeam.score,
      memberCount: placeholderTeam.members.length,
    },
    {
      rank: 2,
      teamId: 'team-456',
      teamName: `${eventId}-Slipstream`,
      score: 1175,
      memberCount: 4,
    },
  ];
}
