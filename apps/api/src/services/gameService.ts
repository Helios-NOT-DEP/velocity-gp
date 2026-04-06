import type {
  GetRaceStateResponse,
  HazardStatusUpdateRequest,
  HazardStatusUpdateResponse,
  LeaderboardEntry,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderPlayer, placeholderTeam } from './placeholderData.js';

export function getRaceState(eventId: string, playerId: string): GetRaceStateResponse {
  const teamStatus = playerId === placeholderPlayer.id ? 'IN_PIT' : placeholderTeam.status;

  return {
    playerId,
    eventId,
    teamId: placeholderTeam.id,
    teamName: placeholderTeam.name,
    teamStatus,
    status: teamStatus,
    raceControlState: 'ACTIVE',
    scannerEnabled: teamStatus !== 'IN_PIT',
    pitStopExpiresAt: teamStatus === 'IN_PIT' ? createIsoDate(15) : null,
    currentLocation: 'PIT_LANE_ALPHA',
    hazardsEncountered: ['qr-alpha-01'],
    score: placeholderTeam.score,
    individualScore: placeholderPlayer.individualScore,
    updatedAt: createIsoDate(0),
  };
}

export function updateHazardStatus(
  eventId: string,
  playerId: string,
  request: HazardStatusUpdateRequest
): HazardStatusUpdateResponse {
  return {
    eventId,
    playerId,
    hazardId: request.hazardId,
    status: request.status,
    updatedAt: createIsoDate(5),
  };
}

export function getLeaderboard(eventId: string): LeaderboardEntry[] {
  return [
    {
      rank: 1,
      teamId: placeholderTeam.id,
      teamName: placeholderTeam.name,
      score: placeholderTeam.score,
      memberCount: placeholderTeam.members.length,
      status: placeholderTeam.status,
    },
    {
      rank: 2,
      teamId: 'team-drift-runners',
      teamName: `${eventId}-Drift-Runners`,
      score: 1110,
      memberCount: 3,
      status: 'ACTIVE',
    },
    {
      rank: 3,
      teamId: 'team-nova-thunder',
      teamName: `${eventId}-Nova-Thunder`,
      score: 920,
      memberCount: 2,
      status: 'IN_PIT',
    },
  ];
}
