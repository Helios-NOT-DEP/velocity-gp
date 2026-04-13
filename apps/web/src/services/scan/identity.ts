import type { PlayerActiveIdentity } from '@velocity-gp/api-contract';
import { apiClient, eventEndpoints } from '@/services/api';

import type { ScanIdentityResolution } from './types';

/**
 * Resolves the authenticated session into a typed ScanIdentity used by the QR scanner.
 *
 * It calls the backend /events/current/players/me endpoint directly to derive all
 * required fields. The email parameter is ignored since the backend reads from session,
 * but retained in signature for compatibility.
 */
export async function resolveScanIdentityForEmail(
  _email: string | undefined
): Promise<ScanIdentityResolution> {
  let response;
  try {
    // Fetch the player identity securely derived from the current session
    response = await apiClient.get<PlayerActiveIdentity>(eventEndpoints.getCurrentEventPlayer);
  } catch {
    // Catch-all for network failures or API availability issues
    return {
      status: 'event_unavailable',
      message: 'Current event could not be loaded. Check connectivity and try scanning again.',
    };
  }

  if (!response.ok) {
    // 401/403/404 errors indicate the user session is invalid, lacks a team/roster
    // assignment for the active event, or the team could not be found.
    if (response.status === 404 || response.status === 403 || response.status === 401) {
      return {
        status: 'unmapped',
        message:
          'No assigned player profile was found for this session in the current event roster.',
      };
    }

    // Fallback for 500s or unexpected errors
    return {
      status: 'event_unavailable',
      message: 'Your player profile could not be loaded for the active event.',
    };
  }

  // Successfully derived identity from backend session context
  return {
    status: 'resolved',
      identity: {
        eventId: response.data.eventId,
        playerId: response.data.playerId,
        teamId: response.data.teamId,
        teamName: response.data.teamName,
        teamStatus: response.data.teamStatus,
        pitStopExpiresAt: response.data.pitStopExpiresAt,
        email: response.data.email,
      },
    };
}
