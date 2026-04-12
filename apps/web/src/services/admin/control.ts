import type {
  GetRaceControlResponse,
  ListAdminAuditsResponse,
  UpdateHeliosRoleRequest,
  UpdateHeliosRoleResponse,
  UpdateRaceControlRequest,
  UpdateRaceControlResponse,
} from '@velocity-gp/api-contract';

import { adminEndpoints, apiClient } from '@/services/api';

export async function getRaceControl(eventId: string): Promise<GetRaceControlResponse> {
  const response = await apiClient.get<GetRaceControlResponse>(
    adminEndpoints.getRaceControl(eventId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load race control state (${response.status}).`);
  }

  return response.data;
}

export async function updateRaceControl(
  eventId: string,
  request: UpdateRaceControlRequest
): Promise<UpdateRaceControlResponse> {
  const response = await apiClient.request<UpdateRaceControlResponse>(
    adminEndpoints.updateRaceControl(eventId),
    {
      method: 'POST',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update race control state (${response.status}).`);
  }

  return response.data;
}

export async function updateHeliosRole(
  userId: string,
  request: UpdateHeliosRoleRequest
): Promise<UpdateHeliosRoleResponse> {
  const response = await apiClient.request<UpdateHeliosRoleResponse>(
    adminEndpoints.updateHeliosRole(userId),
    {
      method: 'POST',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update Helios role (${response.status}).`);
  }

  return response.data;
}

export async function listAdminAudits(
  eventId: string,
  query: { limit?: number; cursor?: string } = {}
): Promise<ListAdminAuditsResponse> {
  const response = await apiClient.get<ListAdminAuditsResponse>(
    adminEndpoints.listAuditEntries(eventId),
    query
  );

  if (!response.ok) {
    throw new Error(`Unable to load admin audit entries (${response.status}).`);
  }

  return response.data;
}
