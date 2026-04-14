/**
 * Moderation Service
 *
 * Provides a single `moderateText(text)` function used by the Garage workflow
 * to validate player self-descriptions before they are stored.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. By default the service calls an n8n webhook at the `/moderation` path.
 *    The webhook is expected to respond with JSON of the shape
 *    `{ "flagged": "false" }` (safe) or `{ "flagged": "true" }` (blocked).
 *    Any flagged response causes the submission to be REJECTED with a clear
 *    policy message.
 *
 * 2. When external moderation is disabled via config the implementation
 *    falls back to a simple keyword blocklist so the flow can still be
 *    exercised end-to-end without a real provider. Swap this section for a
 *    proper mock or test double in unit tests.
 *
 * ADDING A NEW PROVIDER
 * ──────────────────────
 * Implement the `ModerationResult` interface and swap the call inside
 * `moderateText`.  Nothing outside this file needs to change.
 */

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { callN8nWebhook } from '../lib/n8nWebhookClient.js';
// ── Public types ─────────────────────────────────────────────────────────────

export interface ModerationResult {
  /** true → text is safe to store; false → block and return policyMessage to user */
  safe: boolean;
  /** The flagged category name (for internal logging; not shown to users). */
  flaggedCategory?: string;
  /**
   * User-facing sentence explaining why the description was blocked.
   * Only populated when safe === false.
   */
  policyMessage?: string;
}

// ── n8n moderation response shape (very small subset we need) ─────────────

interface N8nModerationResponse {
  flagged: boolean | string | number;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Moderates `text` and returns a typed result.
 *
 * Callers (garageService) decide what to do with the result; this function
 * does not throw on content policy violations — it returns them as data.
 * It DOES throw on network/infrastructure failures so the caller can surface
 * a 5xx rather than silently approving unmoderated content.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  // Allow disabling the external OpenAI call via config for short-term
  // operational reasons. When disabled we fall back to the local keyword
  // blocklist so developers/operators can still exercise the flow.
  if (env.SKIP_OPENAI_MODERATION) {
    logger.warn(
      '[moderationService] External moderation disabled via config — using keyword fallback'
    );
    return keywordFallback(text);
  }

  // Call the n8n moderation webhook. Any infrastructure failure should
  // surface as an exception so callers return a 5xx instead of silently
  // approving content.
  return callN8nModeration(text);
}

// ── n8n moderation implementation ───────────────────────────────────────────

async function callN8nModeration(text: string): Promise<ModerationResult> {
  logger.debug('[moderationService] Calling n8n /moderation webhook');

  const { data } = await callN8nWebhook({
    path: '/moderation',
    payload: { input: text },
    velocityEvent: 'MODERATION',
  });

  if (!data || typeof data !== 'object') {
    throw new Error(
      '[moderationService] Unexpected empty or non-object response from n8n moderation'
    );
  }

  if (!Object.prototype.hasOwnProperty.call(data, 'flagged')) {
    throw new Error(
      "[moderationService] Malformed n8n moderation response: missing 'flagged' field"
    );
  }

  const resp = data as unknown as N8nModerationResponse;
  const rawFlagged = resp.flagged;

  if (
    typeof rawFlagged !== 'boolean' &&
    typeof rawFlagged !== 'string' &&
    typeof rawFlagged !== 'number'
  ) {
    throw new Error(
      "[moderationService] Malformed n8n moderation response: 'flagged' must be boolean|string|number"
    );
  }

  // Normalize: treat boolean true, the string 'true' (case-insensitive), or numeric 1 as flagged
  const flagged =
    rawFlagged === true ||
    String(rawFlagged).toLowerCase() === 'true' ||
    String(rawFlagged) === '1';

  if (!flagged) {
    return { safe: true };
  }

  logger.info('[moderationService] Description flagged by n8n moderation', { rawFlagged });

  return {
    safe: false,
    flaggedCategory: 'n8n-moderation',
    policyMessage:
      'Your description contains content that violates our community guidelines. ' +
      'Please revise it and try again.',
  };
}

// ── Keyword fallback (development only) ──────────────────────────────────────

// Intentionally short list — this is a dev scaffold, not a real content filter.
const BLOCKED_KEYWORDS = ['hate', 'kill', 'violence', 'xxx'];

function keywordFallback(text: string): ModerationResult {
  const lower = text.toLowerCase();
  const match = BLOCKED_KEYWORDS.find((kw) => lower.includes(kw));

  if (match) {
    logger.info('[moderationService] Keyword fallback blocked description', { match });
    return {
      safe: false,
      flaggedCategory: 'keyword-blocklist',
      policyMessage:
        'Your description contains content that violates our community guidelines. ' +
        'Please revise it and try again.',
    };
  }

  return { safe: true };
}
