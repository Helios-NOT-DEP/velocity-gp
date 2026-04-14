/**
 * Integration tests for the moderation path in the Garage workflow.
 *
 * These tests call POST /api/garage/submit end-to-end via supertest so the
 * full Express middleware stack (validation, auth, asyncHandler, error handler)
 * runs exactly as it does in production. The n8n /moderation HTTP call is
 * intercepted by stubbing the global `fetch` so no real n8n server is required.
 *
 * Scenarios covered:
 *   1. n8n returns { flagged: 'false' } → description approved, HTTP 200
 *   2. n8n returns { flagged: 'true' }  → description rejected, HTTP 200 with policyMessage
 *   3. n8n returns { flagged: false }   → normalized boolean safe, HTTP 200
 *   4. n8n returns { flagged: true }    → normalized boolean flagged, HTTP 200
 *   5. n8n returns malformed response (missing flagged) → 500 infrastructure error
 *   6. n8n returns non-2xx status       → 500 infrastructure error
 *   7. SKIP_OPENAI_MODERATION = true    → keyword fallback used (no fetch call)
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app/createApp.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/client.js';
import { createSessionToken } from '../../src/services/authTokens.js';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = createApp();
const apiPrefix = env.API_PREFIX;

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Builds a player-scoped Bearer token for the request Authorization header.
 * Uses the existing `createSessionToken` helper so auth middleware is satisfied
 * without a real database session lookup.
 */
function makeAuthHeader(ids: {
  userId: string;
  playerId: string;
  eventId: string;
  teamId: string;
}): string {
  const sessionToken = createSessionToken({
    userId: ids.userId,
    playerId: ids.playerId,
    eventId: ids.eventId,
    teamId: ids.teamId,
    teamStatus: 'ACTIVE',
    role: 'player',
    email: `player-modtest-${ids.playerId}@velocitygp.dev`,
    displayName: 'Moderation Test Player',
  });
  return `Bearer ${sessionToken}`;
}

/**
 * Returns a fetch stub that responds with a given n8n moderation payload.
 * Only calls to the `/moderation` path are intercepted; all other fetch calls
 * forward to the real global (which is never invoked in this test suite).
 */
function makeModerationFetchStub(n8nResponse: unknown, httpStatus = 200) {
  return vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('/moderation')) {
      const ok = httpStatus >= 200 && httpStatus < 300;
      return {
        ok,
        status: httpStatus,
        statusText: ok ? 'OK' : 'Bad Gateway',
        text: async () => JSON.stringify(n8nResponse),
        json: async () => n8nResponse,
      };
    }
    // Unreachable in these tests — every call should hit /moderation
    throw new Error(`Unexpected fetch call to: ${url}`);
  });
}

// ── DB fixture ────────────────────────────────────────────────────────────────

describe('moderation integration: POST /garage/submit', () => {
  const token = randomUUID().slice(0, 8);

  const ids = {
    userId: `user-mod-${token}`,
    playerId: `player-mod-${token}`,
    teamId: `team-mod-${token}`,
    eventId: `event-mod-${token}`,
  };

  beforeAll(async () => {
    const now = new Date();

    await prisma.user.create({
      data: {
        id: ids.userId,
        email: `player-modtest-${ids.playerId}@velocitygp.dev`,
        displayName: 'Moderation Test Player',
        role: 'PLAYER',
        isHelios: false,
      },
    });

    await prisma.event.create({
      data: {
        id: ids.eventId,
        name: `Moderation Test Event ${token}`,
        startDate: new Date(now.getTime() - 60 * 60_000),
        endDate: new Date(now.getTime() + 60 * 60_000),
        status: 'ACTIVE',
        isPublic: false,
        maxPlayers: 10,
        currentPlayerCount: 1,
      },
    });

    await prisma.eventConfig.create({
      data: {
        eventId: ids.eventId,
        globalHazardRatio: 99,
        pitStopDurationSeconds: 900,
        invalidScanPenalty: 1,
        raceControlState: 'ACTIVE',
      },
    });

    await prisma.team.create({
      data: {
        id: ids.teamId,
        eventId: ids.eventId,
        name: `Moderation Test Team ${token}`,
        score: 0,
        status: 'ACTIVE',
        // Require 3 submissions so logo generation never fires during these tests
        requiredPlayerCount: 3,
      },
    });

    await prisma.player.create({
      data: {
        id: ids.playerId,
        userId: ids.userId,
        eventId: ids.eventId,
        teamId: ids.teamId,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: now,
      },
    });
  });

  afterAll(async () => {
    await prisma.garageSubmission.deleteMany({ where: { teamId: ids.teamId } });
    await prisma.player.deleteMany({ where: { eventId: ids.eventId } });
    await prisma.team.deleteMany({ where: { eventId: ids.eventId } });
    await prisma.eventConfig.deleteMany({ where: { eventId: ids.eventId } });
    await prisma.event.deleteMany({ where: { id: ids.eventId } });
    await prisma.user.deleteMany({ where: { id: ids.userId } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Scenario 1: safe text (string 'false') ──────────────────────────────

  it('approves a description when n8n returns { flagged: "false" }', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({ flagged: 'false' }));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'An honest racing driver who plays fair.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('approved');
    expect(response.body.data.policyMessage).toBeUndefined();

    // Verify DB row was written as APPROVED
    const submission = await prisma.garageSubmission.findUnique({
      where: { playerId_teamId: { playerId: ids.playerId, teamId: ids.teamId } },
    });
    expect(submission?.status).toBe('APPROVED');
  });

  // ── Scenario 2: flagged text (string 'true') ────────────────────────────

  it('rejects a description when n8n returns { flagged: "true" }', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({ flagged: 'true' }));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'This description contains offensive material.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('rejected');
    expect(typeof response.body.data.policyMessage).toBe('string');
    expect(response.body.data.policyMessage.length).toBeGreaterThan(0);

    // Verify DB row was written as REJECTED
    const submission = await prisma.garageSubmission.findUnique({
      where: { playerId_teamId: { playerId: ids.playerId, teamId: ids.teamId } },
    });
    expect(submission?.status).toBe('REJECTED');
  });

  // ── Scenario 3: safe text (boolean false) ──────────────────────────────

  it('approves a description when n8n returns { flagged: false } as a boolean', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({ flagged: false }));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'A clean and spirited driver.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('approved');
  });

  // ── Scenario 4: flagged text (boolean true) ─────────────────────────────

  it('rejects a description when n8n returns { flagged: true } as a boolean', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({ flagged: true }));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'Another description that should be flagged.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('rejected');
    expect(typeof response.body.data.policyMessage).toBe('string');
  });

  // ── Scenario 5: malformed response (missing 'flagged') ──────────────────

  it('returns 500 when n8n response is missing the flagged field', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({ result: 'ok' /* no flagged field */ }));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'A description that will hit a bad n8n response.',
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  // ── Scenario 6: n8n returns non-2xx ─────────────────────────────────────

  it('returns 502 when n8n webhook returns a non-2xx status', async () => {
    vi.stubGlobal('fetch', makeModerationFetchStub({}, 502));

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'A description when n8n is down.',
      });

    // callN8nWebhook throws DependencyError (AppError 502) on non-2xx responses
    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
  });

  // ── Scenario 7: keyword fallback (SKIP_OPENAI_MODERATION = true) ─────────
  // We temporarily override the env flag; fetch should never be called.

  it('uses keyword fallback and approves safe text when SKIP_OPENAI_MODERATION is true', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Temporarily set the skip flag
    const originalSkip = env.SKIP_OPENAI_MODERATION;
    (env as Record<string, unknown>)['SKIP_OPENAI_MODERATION'] = true;

    try {
      const response = await request(app)
        .post(`${apiPrefix}/garage/submit`)
        .set('authorization', makeAuthHeader(ids))
        .send({
          playerId: ids.playerId,
          teamId: ids.teamId,
          eventId: ids.eventId,
          description: 'A perfectly clean description using the keyword fallback.',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('approved');
      // fetch should never have been called — keyword fallback handles it locally
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (env as Record<string, unknown>)['SKIP_OPENAI_MODERATION'] = originalSkip;
    }
  });

  it('uses keyword fallback and rejects blocked keywords when SKIP_OPENAI_MODERATION is true', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const originalSkip = env.SKIP_OPENAI_MODERATION;
    (env as Record<string, unknown>)['SKIP_OPENAI_MODERATION'] = true;

    try {
      const response = await request(app)
        .post(`${apiPrefix}/garage/submit`)
        .set('authorization', makeAuthHeader(ids))
        .send({
          playerId: ids.playerId,
          teamId: ids.teamId,
          eventId: ids.eventId,
          description: 'I want to kill the competition.', // contains 'kill' keyword
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('rejected');
      expect(typeof response.body.data.policyMessage).toBe('string');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (env as Record<string, unknown>)['SKIP_OPENAI_MODERATION'] = originalSkip;
    }
  });

  // ── Validation guard: description too short ───────────────────────────────

  it('returns 400 for a description shorter than the minimum length', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await request(app)
      .post(`${apiPrefix}/garage/submit`)
      .set('authorization', makeAuthHeader(ids))
      .send({
        playerId: ids.playerId,
        teamId: ids.teamId,
        eventId: ids.eventId,
        description: 'ab', // 2 chars — minimum is 3
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // fetch must not be called — Zod validation fires before the service
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
