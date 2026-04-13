import type { HeliosRescueFlow } from '@velocity-gp/api-contract';
import { apiClient } from '../api/index.js';

interface GetRescueLogOptions {
  readonly eventId?: string;
  readonly limit?: number;
}

interface RescueLogResponse {
  readonly rescues: readonly HeliosRescueFlow[];
}

function buildRescueLogQuery(options: GetRescueLogOptions = {}): string {
  const parts: string[] = [];

  if (options.eventId) {
    parts.push(`eventId=${encodeURIComponent(options.eventId)}`);
  }

  if (typeof options.limit === 'number') {
    parts.push(`limit=${encodeURIComponent(String(options.limit))}`);
  }

  const encoded = parts.join('&');
  return encoded.length > 0 ? `?${encoded}` : '';
}

/**
 * Returns recent rescue events initiated by the authenticated Helios user.
 */
export async function getRescueLog(options: GetRescueLogOptions = {}): Promise<HeliosRescueFlow[]> {
  const response = await apiClient.get<RescueLogResponse>(
    `/rescue/log${buildRescueLogQuery(options)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch rescue log: ${response.status}`);
  }

  return [...response.data.rescues];
}
