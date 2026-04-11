import type {
  CreateQRCodeRequest,
  CreateQRCodeResponse,
  DeleteQRCodeResponse,
  ListEventQRCodesResponse,
  SetQRCodeStatusRequest,
  SetQRCodeStatusResponse,
} from '@velocity-gp/api-contract';

import { adminEndpoints, apiClient } from '@/services/api';

export async function listAdminQRCodes(eventId: string): Promise<ListEventQRCodesResponse> {
  const response = await apiClient.get<ListEventQRCodesResponse>(adminEndpoints.listAdminQRCodes(eventId));

  if (!response.ok) {
    throw new Error(`Unable to load QR inventory (${response.status}).`);
  }

  return response.data;
}

export async function createAdminQRCode(
  eventId: string,
  request: CreateQRCodeRequest
): Promise<CreateQRCodeResponse> {
  const response = await apiClient.request<CreateQRCodeResponse>(adminEndpoints.createAdminQRCode(eventId), {
    method: 'POST',
    body: request,
  });

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
