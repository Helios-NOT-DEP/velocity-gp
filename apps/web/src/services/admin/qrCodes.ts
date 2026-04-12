import type {
  CreateHazardMultiplierRuleRequest,
  CreateHazardMultiplierRuleResponse,
  CreateQRCodeRequest,
  CreateQRCodeResponse,
  DeleteHazardMultiplierRuleResponse,
  DeleteQRCodeResponse,
  ExportQrAssetsResponse,
  GetEventHazardSettingsResponse,
  ListEventQRCodesResponse,
  ListHazardMultiplierRulesResponse,
  QrImportApplyResponse,
  QrImportPreviewResponse,
  QrImportRowInput,
  SetQRCodeStatusRequest,
  SetQRCodeStatusResponse,
  UpdateEventHazardSettingsRequest,
  UpdateEventHazardSettingsResponse,
  UpdateHazardMultiplierRuleRequest,
  UpdateHazardMultiplierRuleResponse,
  UpdateQrHazardRandomizerRequest,
  UpdateQrHazardRandomizerResponse,
} from '@velocity-gp/api-contract';

import { adminEndpoints, apiClient } from '@/services/api';

function parseCsvRows(csvText: string): string[][] {
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

function toOptionalIsoDateTime(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function toOptionalInt(value: string | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQrCsv(csvText: string): QrImportRowInput[] {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ['label', 'value'];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`CSV is missing required header: ${header}`);
    }
  }

  const labelIndex = headers.indexOf('label');
  const valueIndex = headers.indexOf('value');
  const zoneIndex = headers.indexOf('zone');
  const activationStartsAtIndex = headers.indexOf('activationstartsat');
  const activationEndsAtIndex = headers.indexOf('activationendsat');
  const hazardRatioOverrideIndex = headers.indexOf('hazardratiooverride');
  const hazardWeightOverrideIndex = headers.indexOf('hazardweightoverride');

  const parsedRows = rows.slice(1).map((row) => {
    const value = Number.parseInt((row[valueIndex] ?? '').trim(), 10);

    return {
      label: (row[labelIndex] ?? '').trim(),
      value: Number.isFinite(value) ? value : 0,
      zone: toOptionalString(zoneIndex >= 0 ? row[zoneIndex] : undefined),
      activationStartsAt: toOptionalIsoDateTime(
        activationStartsAtIndex >= 0 ? row[activationStartsAtIndex] : undefined
      ),
      activationEndsAt: toOptionalIsoDateTime(
        activationEndsAtIndex >= 0 ? row[activationEndsAtIndex] : undefined
      ),
      hazardRatioOverride: toOptionalInt(
        hazardRatioOverrideIndex >= 0 ? row[hazardRatioOverrideIndex] : undefined
      ),
      hazardWeightOverride: toOptionalInt(
        hazardWeightOverrideIndex >= 0 ? row[hazardWeightOverrideIndex] : undefined
      ),
    } satisfies QrImportRowInput;
  });

  if (parsedRows.length === 0) {
    throw new Error('No import rows were found in CSV data.');
  }

  return parsedRows;
}

export async function parseQrCsvFile(file: globalThis.File): Promise<QrImportRowInput[]> {
  const content = await file.text();
  return parseQrCsv(content);
}

export async function listAdminQRCodes(eventId: string): Promise<ListEventQRCodesResponse> {
  const response = await apiClient.get<ListEventQRCodesResponse>(
    adminEndpoints.listAdminQRCodes(eventId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load QR inventory (${response.status}).`);
  }

  return response.data;
}

export async function createAdminQRCode(
  eventId: string,
  request: CreateQRCodeRequest
): Promise<CreateQRCodeResponse> {
  const response = await apiClient.request<CreateQRCodeResponse>(
    adminEndpoints.createAdminQRCode(eventId),
    {
      method: 'POST',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to create QR code (${response.status}).`);
  }

  return response.data;
}

export async function setAdminQRCodeStatus(
  eventId: string,
  qrCodeId: string,
  request: SetQRCodeStatusRequest
): Promise<SetQRCodeStatusResponse> {
  const response = await apiClient.request<SetQRCodeStatusResponse>(
    adminEndpoints.setAdminQRCodeStatus(eventId, qrCodeId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update QR status (${response.status}).`);
  }

  return response.data;
}

export async function updateAdminQrHazardOverrides(
  eventId: string,
  qrCodeId: string,
  request: UpdateQrHazardRandomizerRequest
): Promise<UpdateQrHazardRandomizerResponse> {
  const response = await apiClient.request<UpdateQrHazardRandomizerResponse>(
    adminEndpoints.updateQrHazardRandomizer(eventId, qrCodeId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update QR hazard overrides (${response.status}).`);
  }

  return response.data;
}

export async function deleteAdminQRCode(
  eventId: string,
  qrCodeId: string
): Promise<DeleteQRCodeResponse> {
  const response = await apiClient.request<DeleteQRCodeResponse>(
    adminEndpoints.deleteAdminQRCode(eventId, qrCodeId),
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to delete QR code (${response.status}).`);
  }

  return response.data;
}

export async function previewQrImport(
  eventId: string,
  rows: readonly QrImportRowInput[]
): Promise<QrImportPreviewResponse> {
  const response = await apiClient.request<QrImportPreviewResponse>(
    adminEndpoints.previewQrImport(eventId),
    {
      method: 'POST',
      body: { rows },
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to preview QR import (${response.status}).`);
  }

  return response.data;
}

export async function applyQrImport(
  eventId: string,
  rows: readonly QrImportRowInput[]
): Promise<QrImportApplyResponse> {
  const response = await apiClient.request<QrImportApplyResponse>(
    adminEndpoints.applyQrImport(eventId),
    {
      method: 'POST',
      body: { rows },
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to apply QR import (${response.status}).`);
  }

  return response.data;
}

export async function exportQrAssets(
  eventId: string,
  qrCodeIds?: readonly string[]
): Promise<ExportQrAssetsResponse> {
  const response = await apiClient.request<ExportQrAssetsResponse>(
    adminEndpoints.exportQrAssets(eventId),
    {
      method: 'POST',
      body: qrCodeIds && qrCodeIds.length > 0 ? { qrCodeIds } : {},
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to export QR assets (${response.status}).`);
  }

  return response.data;
}

export async function getEventHazardSettings(
  eventId: string
): Promise<GetEventHazardSettingsResponse> {
  const response = await apiClient.get<GetEventHazardSettingsResponse>(
    adminEndpoints.getHazardSettings(eventId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load hazard settings (${response.status}).`);
  }

  return response.data;
}

export async function updateEventHazardSettings(
  eventId: string,
  request: UpdateEventHazardSettingsRequest
): Promise<UpdateEventHazardSettingsResponse> {
  const response = await apiClient.request<UpdateEventHazardSettingsResponse>(
    adminEndpoints.updateHazardSettings(eventId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update hazard settings (${response.status}).`);
  }

  return response.data;
}

export async function listHazardMultiplierRules(
  eventId: string
): Promise<ListHazardMultiplierRulesResponse> {
  const response = await apiClient.get<ListHazardMultiplierRulesResponse>(
    adminEndpoints.listHazardMultipliers(eventId)
  );

  if (!response.ok) {
    throw new Error(`Unable to load hazard multiplier rules (${response.status}).`);
  }

  return response.data;
}

export async function createHazardMultiplierRule(
  eventId: string,
  request: CreateHazardMultiplierRuleRequest
): Promise<CreateHazardMultiplierRuleResponse> {
  const response = await apiClient.request<CreateHazardMultiplierRuleResponse>(
    adminEndpoints.createHazardMultiplier(eventId),
    {
      method: 'POST',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to create hazard multiplier rule (${response.status}).`);
  }

  return response.data;
}

export async function updateHazardMultiplierRule(
  eventId: string,
  ruleId: string,
  request: UpdateHazardMultiplierRuleRequest
): Promise<UpdateHazardMultiplierRuleResponse> {
  const response = await apiClient.request<UpdateHazardMultiplierRuleResponse>(
    adminEndpoints.updateHazardMultiplier(eventId, ruleId),
    {
      method: 'PATCH',
      body: request,
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to update hazard multiplier rule (${response.status}).`);
  }

  return response.data;
}

export async function deleteHazardMultiplierRule(
  eventId: string,
  ruleId: string
): Promise<DeleteHazardMultiplierRuleResponse> {
  const response = await apiClient.request<DeleteHazardMultiplierRuleResponse>(
    adminEndpoints.deleteHazardMultiplier(eventId, ruleId),
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to delete hazard multiplier rule (${response.status}).`);
  }

  return response.data;
}
