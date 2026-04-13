/**
 * Garage Web Service
 *
 * The ONLY place in the web app that makes HTTP calls for the Garage workflow.
 * Components and hooks import from here — never call apiClient directly for
 * garage operations.
 *
 * This isolation means:
 *   - The API shape can change in one place without touching components
 *   - The service can be swapped for a mock in tests
 *   - Telemetry and error mapping live here, not in JSX
 *
 * Uses the shared ObservableApiClient instance from @/services/api so every
 * request is automatically traced via OpenTelemetry.
 */
import type {
  GarageSubmitRequest,
  GarageSubmitResponse,
  TeamGarageStatus,
} from '@velocity-gp/api-contract';

import { apiClient } from '@/services/api';

// Re-export contract types so components only need to import from here
export type { GarageSubmitRequest, GarageSubmitResponse, TeamGarageStatus };

// ── Service object ────────────────────────────────────────────────────────────

export const garageService = {
  /**
   * Submits a player's self-description for moderation and garage processing.
   *
   * Returns HTTP 200 for both 'approved' and 'rejected' outcomes.
   * Only throws on genuine network / server errors (5xx).
   *
   * Usage:
   *   const result = await garageService.submit({ playerId, teamId, eventId, description });
   *   if (result.status === 'rejected') showPolicyMessage(result.policyMessage);
   */
  async submit(req: GarageSubmitRequest): Promise<GarageSubmitResponse> {
    const response = await apiClient.post<GarageSubmitResponse>('/garage/submit', req);

    if (!response.ok) {
      // 4xx/5xx that slipped through — surface a typed error
      throw new GarageServiceError(
        'Failed to submit description. Please try again.',
        response.status
      );
    }

    // apiClient already unwraps the { success, data } envelope in parseResponseBody
    return response.data;
  },

  /**
   * Fetches the current team garage status snapshot.
   *
   * Called by the UI polling loop every ~4 seconds while the player is in the
   * WAITING or GENERATING state.  Safe to call frequently — no side effects.
   *
   * Usage:
   *   const status = await garageService.getTeamStatus(teamId, playerId);
   *   if (status.logoStatus === 'READY') showLogo(status.logoUrl);
   */
  async getTeamStatus(teamId: string, playerId: string): Promise<TeamGarageStatus> {
    const response = await apiClient.get<TeamGarageStatus>(
      `/garage/team/${encodeURIComponent(teamId)}/status`,
      { playerId }
    );

    if (!response.ok) {
      throw new GarageServiceError('Failed to load team status. Please refresh.', response.status);
    }

    // apiClient already unwraps the { success, data } envelope in parseResponseBody
    return response.data;
  },
};

// ── Typed error class ─────────────────────────────────────────────────────────

export class GarageServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'GarageServiceError';
  }
}
