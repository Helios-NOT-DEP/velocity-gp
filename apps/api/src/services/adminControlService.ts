import type {
  AdminAuditEntry,
  ManualPitControlRequest,
  ManualPitControlResponse,
  UpdateHeliosRoleRequest,
  UpdateHeliosRoleResponse,
  UpdateRaceControlRequest,
  UpdateRaceControlResponse,
} from '@velocity-gp/api-contract';

import { createIsoDate, placeholderAudits, placeholderTeam } from './placeholderData.js';

export function updateRaceControl(
  eventId: string,
  request: UpdateRaceControlRequest
): UpdateRaceControlResponse {
  return {
    eventId,
    state: request.state,
    updatedAt: createIsoDate(1),
    auditId: `audit-race-control-${request.state.toLowerCase()}`,
  };
}

export function manualPitControl(
  eventId: string,
  teamId: string,
  request: ManualPitControlRequest
): ManualPitControlResponse {
  const status = request.action === 'ENTER_PIT' ? 'IN_PIT' : 'ACTIVE';

  return {
    eventId,
    teamId,
    status,
    pitStopExpiresAt:
      status === 'IN_PIT' ? request.pitStopExpiresAt ?? createIsoDate(15) : null,
    updatedAt: createIsoDate(2),
    auditId: `audit-pit-${request.action.toLowerCase()}-${teamId}`,
  };
}

export function updateHeliosRole(
  userId: string,
  request: UpdateHeliosRoleRequest
): UpdateHeliosRoleResponse {
  return {
    userId,
    isHelios: request.isHelios,
    updatedAt: createIsoDate(3),
    auditId: `audit-helios-${request.isHelios ? 'assigned' : 'revoked'}-${userId}`,
  };
}

export function listAdminAudits(eventId: string): AdminAuditEntry[] {
  return [
    ...placeholderAudits,
    {
      id: 'admin-audit-pit-manual',
      eventId,
      actorUserId: 'user-admin-ava',
      actionType: 'PIT_MANUAL_ENTER',
      targetType: 'TEAM',
      targetId: placeholderTeam.id,
      details: {
        reason: 'Manual pit-stop override placeholder',
      },
      createdAt: createIsoDate(-2),
    },
  ];
}
