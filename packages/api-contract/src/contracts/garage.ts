/**
 * Garage Workflow Contract Types
 *
 * These types form the shared boundary between the API and the web client.
 * Both packages import from here so the request/response shapes are always in sync.
 *
 * Flow overview:
 *   1. Player submits a self-description → GarageSubmitRequest
 *   2. API moderates the text and stores the result
 *   3. API returns GarageSubmitResponse (approved or rejected)
 *   4. UI polls TeamGarageStatus until logoStatus === 'READY'
 *   5. Once READY, the team logo URL is shown and the player can enter the Race Hub
 */

// ── Enumerated states ────────────────────────────────────────────────────────

/**
 * Lifecycle of a single player's description submission.
 * Only APPROVED entries count toward the team quota.
 */
export type GarageSubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Lifecycle of the team's logo asset.
 * The UI uses this to drive its state machine (waiting → generating → reveal).
 */
export type TeamLogoStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

// ── Request shapes ───────────────────────────────────────────────────────────

/**
 * Body sent by the player when they submit their self-description.
 * playerId + teamId must be pre-assigned (the player cannot pick their own team).
 */
export interface GarageSubmitRequest {
  readonly playerId: string;
  readonly teamId: string;
  readonly eventId: string;
  /** Free-text, 3–200 characters. Validated by Zod before reaching the service. */
  readonly description: string;
}

// ── Response / query shapes ──────────────────────────────────────────────────

/**
 * The team-level garage progress snapshot returned in every submit response
 * and by the status polling endpoint.
 *
 * The UI only needs this single object to render any garage screen state.
 */
export interface TeamGarageStatus {
  readonly teamId: string;
  /** Pre-assigned team name used verbatim in the logo prompt. */
  readonly teamName: string;
  /** Populated once logoStatus reaches 'READY'. */
  readonly logoUrl: string | null;
  /** Drives the UI state machine. */
  readonly logoStatus: TeamLogoStatus;
  /** Total assigned players on this team (denominator in the progress indicator). */
  readonly totalMembers: number;
  /** Count of APPROVED submissions so far (numerator in the progress indicator). */
  readonly approvedCount: number;
  /** Minimum approved submissions before logo generation fires. */
  readonly requiredCount: number;
  /** Whether the calling player has already submitted, and the result of that submission. */
  readonly mySubmission: {
    readonly submitted: boolean;
    readonly status: GarageSubmissionStatus | null;
  };
}

/**
 * Response to POST /garage/submit.
 *
 * On rejection the API returns HTTP 200 (not 4xx) so the UI can render the
 * policy message gracefully rather than treating it as a hard error.
 * The `status` field discriminates between the two outcomes.
 */
export interface GarageSubmitResponse {
  /** 'approved' → description stored; 'rejected' → blocked by moderation. */
  readonly status: 'approved' | 'rejected';
  /**
   * Human-readable explanation shown to the player when their description is
   * rejected.  Only present when status === 'rejected'.
   */
  readonly policyMessage?: string;
  /** Current team progress regardless of this submission's outcome. */
  readonly teamGarageStatus: TeamGarageStatus;
}
