import type {
  DeleteAdminTeamResponse,
  GetAdminPlayerDetailResponse,
  GetAdminTeamDetailResponse,
  ListAdminPlayerScanHistoryQuery,
  ListAdminPlayerScanHistoryResponse,
  ListAdminRosterQuery,
  ListAdminRosterResponse,
  ListAdminRosterTeamsResponse,
  ManualPitControlRequest,
  ManualPitControlResponse,
  RosterImportApplyResponse,
  RosterImportPreviewResponse,
  RosterImportRowInput,
  UpdateAdminPlayerContactRequest,
  UpdateAdminPlayerContactResponse,
  UpdateAdminTeamScoreRequest,
  UpdateAdminTeamScoreResponse,
  UpdateRosterAssignmentResponse,
} from '@velocity-gp/api-contract';

import { adminEndpoints, apiClient, eventEndpoints, type EventSummary } from '@/services/api';

function parseCsvRows(csvText: string): string[][] {
  // Minimal CSV parser supporting quoted values and escaped quotes.
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const normalizedInput = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let index = 0; index < normalizedInput.length; index += 1) {
    const char = normalizedInput[index];
    const next = normalizedInput[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function toOptionalString(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseRosterCsv(csvText: string): RosterImportRowInput[] {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headerRow = rows[0];
  const headers = headerRow.map(normalizeHeader);
  const requiredHeaders = ['workemail', 'displayname'];

  for (const requiredHeader of requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`CSV is missing required header: ${requiredHeader}`);
    }
  }

  const workEmailIndex = headers.indexOf('workemail');
  const displayNameIndex = headers.indexOf('displayname');
  const phoneIndex = headers.indexOf('phonee164');
  const teamNameIndex = headers.indexOf('teamname');

  const parsedRows = rows.slice(1).map((row) => ({
    workEmail: (row[workEmailIndex] ?? '').trim(),
    displayName: (row[displayNameIndex] ?? '').trim(),
    phoneE164: toOptionalString(phoneIndex >= 0 ? row[phoneIndex] : undefined),
    teamName: toOptionalString(teamNameIndex >= 0 ? row[teamNameIndex] : undefined),
  }));

  if (parsedRows.length === 0) {
    throw new Error('No import rows were found in CSV data.');
  }

  return parsedRows;
}

export async function parseRosterCsvFile(file: globalThis.File): Promise<RosterImportRowInput[]> {
  const content = await file.text();
  return parseRosterCsv(content);
}

export async function getCurrentEventId(): Promise<string> {
  // Admin pages scope all roster actions to the currently active event.
  const eventResponse = await apiClient.get<EventSummary>(eventEndpoints.getCurrentEvent);
  if (!eventResponse.ok) {
    throw new Error(`Unable to load current event (${eventResponse.status}).`);
  }

  return eventResponse.data.id;
}

export async function listAdminRoster(
  eventId: string,
  query: ListAdminRosterQuery
): Promise<ListAdminRosterResponse> {
  const response = await apiClient.get<ListAdminRosterResponse>(
    adminEndpoints.listRoster(eventId),
    query
  );
  if (!response.ok) {
    throw new Error(`Unable to load roster (${response.status}).`);
  }

  return response.data;
}

export async function listAdminRosterTeams(eventId: string): Promise<ListAdminRosterTeamsResponse> {
  const response = await apiClient.get<ListAdminRosterTeamsResponse>(
    adminEndpoints.listRosterTeams(eventId)
  );
  if (!response.ok) {
    throw new Error(`Unable to load roster teams (${response.status}).`);
  }

  return response.data;
}

export async function updateAdminRosterAssignment(
  eventId: string,
  playerId: string,
  teamId: string | null,
  reason?: string
): Promise<UpdateRosterAssignmentResponse> {
  // PATCH is used so callers can set team assignment to a specific team or null (unassign).
  const response = await apiClient.request<UpdateRosterAssignmentResponse>(
    adminEndpoints.updateRosterAssignment(eventId, playerId),
    {
      method: 'PATCH',
      body: {
        teamId,
        ...(reason ? { reason } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update assignment (${response.status}).`);
  }

  return response.data;
}

export async function getAdminTeamDetail(
  eventId: string,
  teamId: string
): Promise<GetAdminTeamDetailResponse> {
  const response = await apiClient.get<GetAdminTeamDetailResponse>(
    adminEndpoints.getTeamDetail(eventId, teamId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load team detail (${response.status}).`);
  }

  return response.data;
}

export async function updateAdminTeamScore(
  eventId: string,
  teamId: string,
  request: UpdateAdminTeamScoreRequest
): Promise<UpdateAdminTeamScoreResponse> {
  const response = await apiClient.request<UpdateAdminTeamScoreResponse>(
    adminEndpoints.updateTeamScore(eventId, teamId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update team score (${response.status}).`);
  }

  return response.data;
}

export async function updateAdminTeamPitControl(
  eventId: string,
  teamId: string,
  request: ManualPitControlRequest
): Promise<ManualPitControlResponse> {
  const response = await apiClient.request<ManualPitControlResponse>(
    adminEndpoints.manualPitControl(eventId, teamId),
    {
      method: 'POST',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update pit control (${response.status}).`);
  }

  return response.data;
}

export async function deleteAdminTeam(
  eventId: string,
  teamId: string
): Promise<DeleteAdminTeamResponse> {
  const response = await apiClient.request<DeleteAdminTeamResponse>(
    adminEndpoints.deleteTeam(eventId, teamId),
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to delete team (${response.status}).`);
  }

  return response.data;
}

export async function getAdminPlayerDetail(
  eventId: string,
  playerId: string
): Promise<GetAdminPlayerDetailResponse> {
  const response = await apiClient.get<GetAdminPlayerDetailResponse>(
    adminEndpoints.getPlayerDetail(eventId, playerId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load player detail (${response.status}).`);
  }

  return response.data;
}

export async function updateAdminPlayerContact(
  eventId: string,
  playerId: string,
  request: UpdateAdminPlayerContactRequest
): Promise<UpdateAdminPlayerContactResponse> {
  const response = await apiClient.request<UpdateAdminPlayerContactResponse>(
    adminEndpoints.updatePlayerContact(eventId, playerId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update player contact (${response.status}).`);
  }

  return response.data;
}

export async function listAdminPlayerScanHistory(
  eventId: string,
  playerId: string,
  query: ListAdminPlayerScanHistoryQuery = {}
): Promise<ListAdminPlayerScanHistoryResponse> {
  const response = await apiClient.get<ListAdminPlayerScanHistoryResponse>(
    adminEndpoints.listPlayerScanHistory(eventId, playerId),
    query
  );

  if (!response.ok) {
    throw new Error(`Unable to load player scan history (${response.status}).`);
  }

  return response.data;
}

export async function previewAdminRosterImport(
  eventId: string,
  rows: readonly RosterImportRowInput[]
): Promise<RosterImportPreviewResponse> {
  const response = await apiClient.request<RosterImportPreviewResponse>(
    adminEndpoints.previewRosterImport(eventId),
    {
      method: 'POST',
      body: {
        rows,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to preview roster import (${response.status}).`);
  }

  return response.data;
}

export async function applyAdminRosterImport(
  eventId: string,
  rows: readonly RosterImportRowInput[]
): Promise<RosterImportApplyResponse> {
  const response = await apiClient.request<RosterImportApplyResponse>(
    adminEndpoints.applyRosterImport(eventId),
    {
      method: 'POST',
      body: {
        rows,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to apply roster import (${response.status}).`);
  }

  return response.data;
}
