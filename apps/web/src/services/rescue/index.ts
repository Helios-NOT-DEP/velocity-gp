import type { HeliosRescueFlow } from '@velocity-gp/api-contract';
import { apiClient } from '../api/index.js';

interface GetRescueLogOptions {
  readonly eventId?: string;
  readonly limit?: number;
}

interface RescueLogResponse {
  readonly rescues: readonly HeliosRescueFlow[];
}

/**
 * Returns recent rescue events initiated by the authenticated Helios user.
 */
export async function getRescueLog(options: GetRescueLogOptions = {}): Promise<HeliosRescueFlow[]> {
  const response = await apiClient.get<RescueLogResponse>('/rescue/log', options);

  if (!response.ok) {
    throw new Error(`Failed to fetch rescue log: ${response.status}`);
  }

  return [...response.data.rescues];
}
