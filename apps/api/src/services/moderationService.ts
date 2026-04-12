/**
 * Moderation Service
 *
 * Provides a single `moderateText(text)` function used by the Garage workflow
 * to validate player self-descriptions before they are stored.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. In production/development (when OPENAI_API_KEY is set):
 *    Calls the OpenAI Moderations endpoint (/v1/moderations).
 *    This is a free API call that runs in ~300 ms and classifies text across
 *    several harm categories (hate, violence, sexual, self-harm, etc.).
 *    Any flagged category causes the submission to be REJECTED with a clear
 *    policy message.
 *
 * 2. When OPENAI_API_KEY is absent (local dev / CI without credentials):
 *    Falls through to a simple keyword blocklist so the flow can still be
 *    exercised end-to-end without a real API key.
 *    Swap this section for a proper mock or test double in unit tests.
 *
 * ADDING A NEW PROVIDER
 * ──────────────────────
 * Implement the `ModerationResult` interface and swap the call inside
 * `moderateText`.  Nothing outside this file needs to change.
 */
import fetch from 'node-fetch';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

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

// ── OpenAI moderation response shape (subset we need) ───────────────────────

interface OpenAIModerationResponse {
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
  }>;
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
  // ── Path 1: OpenAI Moderations API ────────────────────────────────────────
  if (env.OPENAI_API_KEY) {
    return callOpenAIModeration(text);
  }

  // ── Path 2: Keyword fallback (local dev only) ──────────────────────────────
  logger.warn('[moderationService] OPENAI_API_KEY not set — using keyword fallback');
  return keywordFallback(text);
}

// ── OpenAI implementation ────────────────────────────────────────────────────

async function callOpenAIModeration(text: string): Promise<ModerationResult> {
  logger.debug('[moderationService] Calling OpenAI /v1/moderations');

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization header is sent only — never logged
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    // Infrastructure error — throw so the route returns 500, not a silent pass
    throw new Error(
      `[moderationService] OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as OpenAIModerationResponse;
  const result = data.results[0];

  if (!result) {
    throw new Error('[moderationService] Unexpected empty results from OpenAI Moderations API');
  }

  if (!result.flagged) {
    // Clean text
    return { safe: true };
  }

  // Find the first category that fired so we can log it internally
  const flaggedCategory =
    Object.entries(result.categories).find(([, flagged]) => flagged)?.[0] ?? 'unknown';

  logger.info(
    { flaggedCategory },
    '[moderationService] Description flagged by OpenAI moderation'
  );

  return {
    safe: false,
    flaggedCategory,
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
    logger.info({ match }, '[moderationService] Keyword fallback blocked description');
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
