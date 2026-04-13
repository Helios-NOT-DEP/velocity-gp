import { apiClient } from '../api/index.js';
import type {
  GetSuperpowerQRResponse,
  RegenerateSuperpowerQRResponse,
} from '@velocity-gp/api-contract';
import { heliosEndpoints } from '@velocity-gp/api-contract';

/**
 * Fetches the active Superpower QR asset for the given player.
 *
 * @param playerId - The player's database identifier.
 * @returns The active {@link GetSuperpowerQRResponse} with the identity-bound QR asset.
 * @throws {Error} If the API request fails.
 */
export async function getSuperpowerQr(playerId: string): Promise<GetSuperpowerQRResponse> {
  const response = await apiClient.get<GetSuperpowerQRResponse>(
    heliosEndpoints.getSuperpowerQr(playerId)
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Superpower QR: ${response.status}`);
  }

  return response.data;
}

/**
 * Revokes the player's current Superpower QR and provisions a fresh replacement.
 *
 * @param playerId - The player's database identifier.
 * @returns The new {@link RegenerateSuperpowerQRResponse} with the replacement QR asset.
 * @throws {Error} If the API request fails.
 */
export async function regenerateSuperpowerQr(
  playerId: string
): Promise<RegenerateSuperpowerQRResponse> {
  const response = await apiClient.post<RegenerateSuperpowerQRResponse>(
    heliosEndpoints.regenerateSuperpowerQr(playerId),
    {}
  );

  if (!response.ok) {
    throw new Error(`Failed to regenerate Superpower QR: ${response.status}`);
  }

  return response.data;
}
