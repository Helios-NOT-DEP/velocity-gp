import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app/createApp.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/client.js';
import { setEmailDispatcherForTests } from '../../src/services/emailDispatchService.js';
import { createMagicLinkToken, createSessionToken } from '../../src/services/authTokens.js';
import { AUTH_SESSION_COOKIE_NAME } from '../../src/services/authSessionToken.js';

const apiPackageVersion = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

describe('velocity gp backend', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;
  const n8nWebhookToken = env.N8N_WEBHOOK_TOKEN ?? 'velocity-gp-dev-webhook-token';
  const mailtrapWebhookSecret = env.MAILTRAP_WEBHOOK_SECRET ?? 'velocity-gp-dev-mailtrap-secret';
  const mailtrapAuditActorEmail = env.MAILTRAP_AUDIT_ACTOR_EMAIL;
  const token = randomUUID().slice(0, 8);
  const fixtureIds = {
    eventId: `event-app-${token}`,
    teamId: `team-app-${token}`,
    secondTeamId: `team-app-second-${token}`,
    playerId: `player-app-${token}`,
    playerUserId: `user-player-app-${token}`,
    unassignedPlayerId: `player-unassigned-app-${token}`,
    unassignedUserId: `user-unassigned-app-${token}`,
    adminUserId: `user-admin-app-${token}`,
    adminMixedCaseUserId: `user-admin-mixed-case-app-${token}`,
    qrCodeId: `qr-app-${token}`,
    qrPayload: `VG-APP-${token.toUpperCase()}`,
    heliosUserId: `user-helios-app-${token}`,
    heliosPlayerId: `player-helios-app-${token}`,
  };

  function buildMailtrapSignatureHeaders(payload: unknown): Record<string, string> {
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const serializedPayload = JSON.stringify(payload);
    const signature = createHmac('sha256', mailtrapWebhookSecret)
      .update(`${timestamp}.${serializedPayload}`)
      .digest('hex');

    return {
      'x-mailtrap-signature': `sha256=${signature}`,
      'x-mailtrap-timestamp': timestamp,
    };
  }

  function createPlayerSessionAuthHeader(
    overrides?: Partial<{ playerId: string; userId: string; teamId: string }>
  ): string {
    const sessionToken = createSessionToken({
      userId: overrides?.userId ?? fixtureIds.playerUserId,
      playerId: overrides?.playerId ?? fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      teamId: overrides?.teamId ?? fixtureIds.teamId,
      teamStatus: 'ACTIVE',
      role: 'player',
      email: `player-${token}@velocitygp.dev`,
      displayName: 'Player Fixture',
    });

    return `Bearer ${sessionToken}`;
  }

  beforeAll(async () => {
    const now = new Date();

    await prisma.user.createMany({
      data: [
        {
          id: fixtureIds.adminUserId,
          email: `admin-${token}@velocitygp.dev`,
          displayName: 'Admin Fixture',
          role: 'ADMIN',
          isHelios: false,
        },
        {
          id: fixtureIds.adminMixedCaseUserId,
          email: `AdminMixed-${token}@velocitygp.dev`,
          displayName: 'Admin Mixed Case Fixture',
          role: 'ADMIN',
          canAdmin: true,
          canPlayer: false,
          isHelios: false,
        },
        {
          id: fixtureIds.playerUserId,
          email: `player-${token}@velocitygp.dev`,
          displayName: 'Player Fixture',
          role: 'PLAYER',
          isHelios: false,
        },
        {
          id: fixtureIds.unassignedUserId,
          email: `unassigned-${token}@velocitygp.dev`,
          displayName: 'Unassigned Fixture',
          role: 'PLAYER',
          isHelios: false,
        },
        {
          id: fixtureIds.heliosUserId,
          email: `helios-${token}@velocitygp.dev`,
          displayName: 'Helios Fixture',
          role: 'HELIOS',
          isHelios: true,
          isHeliosMember: true,
        },
      ],
    });

    await prisma.event.create({
      data: {
        id: fixtureIds.eventId,
        name: `App Test Event ${token}`,
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
        eventId: fixtureIds.eventId,
        globalHazardRatio: 99,
        pitStopDurationSeconds: 900,
        invalidScanPenalty: 1,
        raceControlState: 'ACTIVE',
      },
    });

    await prisma.team.createMany({
      data: [
        {
          id: fixtureIds.teamId,
          eventId: fixtureIds.eventId,
          name: `App Team ${token}`,
          score: 0,
          status: 'ACTIVE',
        },
        {
          id: fixtureIds.secondTeamId,
          eventId: fixtureIds.eventId,
          name: `App Pending Team ${token}`,
          score: 0,
          status: 'PENDING',
        },
      ],
    });

    await prisma.player.create({
      data: {
        id: fixtureIds.playerId,
        userId: fixtureIds.playerUserId,
        eventId: fixtureIds.eventId,
        teamId: fixtureIds.teamId,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: now,
      },
    });

    await prisma.player.create({
      data: {
        id: fixtureIds.unassignedPlayerId,
        userId: fixtureIds.unassignedUserId,
        eventId: fixtureIds.eventId,
        teamId: null,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: now,
      },
    });

    await prisma.player.create({
      data: {
        id: fixtureIds.heliosPlayerId,
        userId: fixtureIds.heliosUserId,
        eventId: fixtureIds.eventId,
        teamId: fixtureIds.teamId,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: now,
      },
    });

    await prisma.qRCode.create({
      data: {
        id: fixtureIds.qrCodeId,
        eventId: fixtureIds.eventId,
        label: `App QR ${token}`,
        value: 80,
        zone: 'App Zone',
        payload: fixtureIds.qrPayload,
        status: 'ACTIVE',
        hazardRatioOverride: null,
        scanCount: 0,
      },
    });
  });

  afterAll(async () => {
    await prisma.emailEvent.deleteMany({
      where: {
        recipientEmailNormalized: {
          endsWith: `${token}@velocitygp.dev`,
        },
      },
    });
    await prisma.adminActionAudit.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.teamStateTransition.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.rescue.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.scanRecord.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.teamActivityEvent.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.qRCodeClaim.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.player.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.superpowerQRAsset.deleteMany({
      where: {
        userId: fixtureIds.heliosUserId,
      },
    });
    await prisma.qRCode.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.team.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.eventConfig.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.hazardMultiplierRule.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
      },
    });
    await prisma.event.deleteMany({
      where: {
        id: fixtureIds.eventId,
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: `${token}@velocitygp.dev`,
        },
      },
    });
    setEmailDispatcherForTests(null);
  });

  it('returns health information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('velocity-gp-bff');
    expect(response.body.data.version).toBe(apiPackageVersion.version);
  });

  it('returns readiness information', async () => {
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.version).toBe(apiPackageVersion.version);
    expect(response.body.data.checks).toMatchObject({
      api: true,
      databaseConfigured: expect.any(Boolean),
    });
  });

  it('serves placeholder race state data', async () => {
    const response = await request(app).get(
      `${apiPrefix}/events/event-123/players/player-123/race-state`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.playerId).toBe('player-123');
    expect(response.body.data.eventId).toBe('event-123');
    expect(response.body.data).toMatchObject({
      scannerEnabled: true,
      raceControlState: 'ACTIVE',
      teamStatus: 'ACTIVE',
    });
  });

  it('accepts canonical scan submissions and returns typed outcomes', async () => {
    const safeResponse = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', createPlayerSessionAuthHeader())
      .send({ playerId: fixtureIds.playerId, qrPayload: fixtureIds.qrPayload });

    expect(safeResponse.status).toBe(200);
    expect(safeResponse.body.success).toBe(true);
    expect(safeResponse.body.data.outcome).toBe('SAFE');
    expect(safeResponse.body.data.pointsAwarded).toBeGreaterThan(0);
  });

  it('accepts scan submissions for legacy header-auth players', async () => {
    const legacyPayload = `VG-LEGACY-${token.toUpperCase()}`;
    await prisma.qRCode.create({
      data: {
        id: `qr-legacy-${token}`,
        eventId: fixtureIds.eventId,
        label: `Legacy QR ${token}`,
        value: 20,
        zone: 'Legacy Zone',
        payload: legacyPayload,
        status: 'ACTIVE',
      },
    });

    const response = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('x-user-id', fixtureIds.playerId)
      .set('x-user-role', 'player')
      .send({ playerId: fixtureIds.playerId, qrPayload: legacyPayload });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.outcome).toBe('SAFE');
  });

  it('supports legacy /hazards/scan alias with matching contract shape', async () => {
    const response = await request(app).post(`${apiPrefix}/hazards/scan`).send({
      playerId: fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      qrCode: 'VG-UNKNOWN-404',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.outcome).toBe('INVALID');
    expect(response.body.data.errorCode).toBe('QR_NOT_FOUND');
    expect(response.body.data.flaggedForReview).toBe(true);
  });

  it('records onboarding and scan events in the team activity feed endpoint', async () => {
    const playerEmail = `player-${token}@velocitygp.dev`;
    const onboardingMagicLinkToken = createMagicLinkToken({
      userId: fixtureIds.playerUserId,
      playerId: fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      email: playerEmail,
    });

    const verifyResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/verify`)
      .send({ token: onboardingMagicLinkToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    const sessionToken = String(verifyResponse.body.data.sessionToken);

    const onboardingFeedResponse = await request(app)
      .get(`${apiPrefix}/events/${fixtureIds.eventId}/teams/${fixtureIds.teamId}/activity-feed`)
      .set('authorization', `Bearer ${sessionToken}`)
      .query({ limit: 25 });

    expect(onboardingFeedResponse.status).toBe(200);
    expect(onboardingFeedResponse.body.success).toBe(true);
    const onboardingItem = onboardingFeedResponse.body.data.items.find(
      (item: { type: string; playerId: string }) =>
        item.type === 'PLAYER_ONBOARDING_COMPLETED' && item.playerId === fixtureIds.playerId
    );
    expect(onboardingItem).toBeDefined();

    const feedQrCodeId = `qr-feed-${token}`;
    const feedQrPayload = `VG-FEED-${token.toUpperCase()}`;
    await prisma.qRCode.create({
      data: {
        id: feedQrCodeId,
        eventId: fixtureIds.eventId,
        label: `Feed QR ${token}`,
        value: 55,
        zone: 'Feed Zone',
        payload: feedQrPayload,
        status: 'ACTIVE',
      },
    });

    const scanResponse = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', createPlayerSessionAuthHeader())
      .send({
        playerId: fixtureIds.playerId,
        qrPayload: feedQrPayload,
      });

    expect(scanResponse.status).toBe(200);
    expect(scanResponse.body.success).toBe(true);
    expect(scanResponse.body.data.outcome).toBe('SAFE');

    const postScanFeedResponse = await request(app)
      .get(`${apiPrefix}/events/${fixtureIds.eventId}/teams/${fixtureIds.teamId}/activity-feed`)
      .set('authorization', `Bearer ${sessionToken}`)
      .query({ limit: 25 });

    expect(postScanFeedResponse.status).toBe(200);
    expect(postScanFeedResponse.body.success).toBe(true);
    expect(postScanFeedResponse.body.data.items[0].type).toBe('PLAYER_QR_SCAN');
    expect(postScanFeedResponse.body.data.items[0].qrPayload).toBe(feedQrPayload);
    expect(postScanFeedResponse.body.data.items[0].scanOutcome).toBe('SAFE');
    expect(postScanFeedResponse.body.data.items[0].pointsAwarded).toBe(55);
  });

  it('normalizes unexpected activity feed errorCode values to null', async () => {
    const playerEmail = `player-${token}@velocitygp.dev`;
    const sessionToken = createSessionToken({
      userId: fixtureIds.playerUserId,
      playerId: fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      teamId: fixtureIds.teamId,
      teamStatus: 'ACTIVE',
      role: 'player',
      email: playerEmail,
      displayName: 'Player Fixture',
    });

    const unexpectedPayload = `VG-UNEXPECTED-${token.toUpperCase()}`;
    await prisma.teamActivityEvent.create({
      data: {
        eventId: fixtureIds.eventId,
        teamId: fixtureIds.teamId,
        playerId: fixtureIds.playerId,
        type: 'PLAYER_QR_SCAN',
        sourceKey: `unexpected-error:${fixtureIds.playerId}:${token}`,
        scanOutcome: 'BLOCKED',
        pointsAwarded: 0,
        errorCode: 'UNMAPPED_ERROR_CODE',
        qrCodeLabel: 'Unexpected Error QR',
        qrPayload: unexpectedPayload,
        summary: 'Unexpected error code persisted in historical feed row.',
        occurredAt: new Date(Date.now() + 1_000),
      },
    });

    const response = await request(app)
      .get(`${apiPrefix}/events/${fixtureIds.eventId}/teams/${fixtureIds.teamId}/activity-feed`)
      .set('authorization', `Bearer ${sessionToken}`)
      .query({ limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const insertedItem = response.body.data.items.find(
      (item: { type: string; qrPayload?: string }) =>
        item.type === 'PLAYER_QR_SCAN' && item.qrPayload === unexpectedPayload
    );
    expect(insertedItem).toBeDefined();
    expect(insertedItem.errorCode).toBeNull();
  });

  it('rejects team activity feed requests outside the authenticated team context', async () => {
    const playerEmail = `player-${token}@velocitygp.dev`;
    const sessionToken = createSessionToken({
      userId: fixtureIds.playerUserId,
      playerId: fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      teamId: fixtureIds.teamId,
      teamStatus: 'ACTIVE',
      role: 'player',
      email: playerEmail,
      displayName: 'Player Fixture',
    });

    const response = await request(app)
      .get(
        `${apiPrefix}/events/${fixtureIds.eventId}/teams/${fixtureIds.secondTeamId}/activity-feed`
      )
      .set('authorization', `Bearer ${sessionToken}`)
      .query({ limit: 25 });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_TEAM_CONTEXT_MISMATCH');
  });

  it('rejects scans for QR codes outside activation window', async () => {
    const futurePayload = `VG-FUTURE-${token.toUpperCase()}`;
    await prisma.qRCode.create({
      data: {
        id: `qr-future-${token}`,
        eventId: fixtureIds.eventId,
        label: `Future QR ${token}`,
        value: 100,
        zone: 'Future Zone',
        payload: futurePayload,
        status: 'ACTIVE',
        activationStartsAt: new Date(Date.now() + 60 * 60 * 1_000),
        activationEndsAt: null,
      },
    });

    const response = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', createPlayerSessionAuthHeader())
      .send({ playerId: fixtureIds.playerId, qrPayload: futurePayload });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.outcome).toBe('INVALID');
    expect(response.body.data.errorCode).toBe('QR_NOT_FOUND');
    expect(response.body.data.flaggedForReview).toBe(true);
  });

  it('returns duplicate scan outcomes with HTTP 200 for successful processing', async () => {
    const authorization = createPlayerSessionAuthHeader();
    const duplicatePayload = `VG-DUPLICATE-${token.toUpperCase()}`;

    await prisma.qRCode.create({
      data: {
        id: `qr-duplicate-${token}`,
        eventId: fixtureIds.eventId,
        label: `Duplicate QR ${token}`,
        value: 10,
        zone: 'Duplicate Zone',
        payload: duplicatePayload,
        status: 'ACTIVE',
      },
    });

    const firstResponse = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', authorization)
      .send({ playerId: fixtureIds.playerId, qrPayload: duplicatePayload });
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.data.outcome).toBe('SAFE');

    const duplicateResponse = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', authorization)
      .send({ playerId: fixtureIds.playerId, qrPayload: duplicatePayload });
    expect(duplicateResponse.status).toBe(200);
    expect(duplicateResponse.body.success).toBe(true);
    expect(duplicateResponse.body.data.outcome).toBe('DUPLICATE');
  });

  it('rejects player sessions that submit scans for a different playerId', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', createPlayerSessionAuthHeader())
      .send({
        playerId: fixtureIds.unassignedPlayerId,
        qrPayload: fixtureIds.qrPayload,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('validates request bodies', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/players`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not-found for ineligible magic-link requests and accepted for eligible users', async () => {
    const assignedEmail = `player-${token}@velocitygp.dev`;
    const unknownEmail = `unknown-${token}@velocitygp.dev`;
    const unassignedEmail = `unassigned-${token}@velocitygp.dev`;
    const capturedLinks: string[] = [];

    setEmailDispatcherForTests({
      dispatch: async (input) => {
        if (input.templateKey === 'magic_link_login') {
          capturedLinks.push(input.variables['magicLinkUrl'] as string);
        }
      },
    });

    const [assignedResponse, unknownResponse, unassignedResponse] = await Promise.all([
      request(app).post(`${apiPrefix}/auth/magic-link/request`).send({ workEmail: assignedEmail }),
      request(app).post(`${apiPrefix}/auth/magic-link/request`).send({ workEmail: unknownEmail }),
      request(app)
        .post(`${apiPrefix}/auth/magic-link/request`)
        .send({ workEmail: unassignedEmail }),
    ]);

    expect(assignedResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(404);
    expect(unassignedResponse.status).toBe(404);
    expect(assignedResponse.body.success).toBe(true);
    expect(unknownResponse.body.success).toBe(false);
    expect(unassignedResponse.body.success).toBe(false);
    expect(assignedResponse.body.data.accepted).toBe(true);
    expect(unknownResponse.body.error.code).toBe('AUTH_USER_NOT_FOUND');
    expect(unassignedResponse.body.error.code).toBe('AUTH_USER_NOT_FOUND');
    expect(capturedLinks.length).toBe(1);
    expect(new URL(capturedLinks[0]).origin).toBe(new URL(env.FRONTEND_MAGIC_LINK_ORIGIN).origin);
  });

  it('returns accepted magic-link response when email dispatch fails', async () => {
    const assignedEmail = `player-${token}@velocitygp.dev`;

    setEmailDispatcherForTests({
      dispatch: async () => {
        throw new Error('simulated dispatch failure');
      },
    });

    const response = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: assignedEmail });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accepted).toBe(true);
    expect(typeof response.body.data.message).toBe('string');
  });

  it('accepts magic-link requests for admin users without active player assignment', async () => {
    const adminEmail = `admin-${token}@velocitygp.dev`;

    setEmailDispatcherForTests({
      dispatch: async () => {
        return;
      },
    });

    const response = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: adminEmail });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accepted).toBe(true);
  });

  it('accepts magic-link requests for admin users when stored email casing differs', async () => {
    const mixedCaseAdminEmail = `adminmixed-${token}@velocitygp.dev`;
    const capturedLinks: string[] = [];

    setEmailDispatcherForTests({
      dispatch: async (input) => {
        if (input.templateKey === 'magic_link_login') {
          capturedLinks.push(input.variables['magicLinkUrl'] as string);
        }
      },
    });

    const response = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: mixedCaseAdminEmail });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accepted).toBe(true);
    expect(capturedLinks.length).toBe(1);
  });

  it('verifies magic links for admin users without player context and routes to admin control', async () => {
    const adminToken = createMagicLinkToken({
      userId: fixtureIds.adminMixedCaseUserId,
      playerId: null,
      eventId: null,
      email: `adminmixed-${token}@velocitygp.dev`,
    });

    const verifyResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/verify`)
      .send({ token: adminToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.redirectPath).toBe('/admin/game-control');
    expect(verifyResponse.body.data.session.userId).toBe(fixtureIds.adminMixedCaseUserId);
    expect(verifyResponse.body.data.session.playerId).toBeNull();
    expect(verifyResponse.body.data.session.assignmentStatus).toBe('UNASSIGNED');
  });

  it('rejects Mailtrap webhook requests without a valid bearer token', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/webhooks/mailtrap/events`)
      .send({
        events: [
          {
            eventType: 'delivered',
            recipientEmail: `player-${token}@velocitygp.dev`,
          },
        ],
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('ingests Mailtrap events, persists them, and flags return-email accounts on bounce', async () => {
    const recipientEmail = `player-${token}@velocitygp.dev`;
    const payload = {
      processedAt: new Date().toISOString(),
      events: [
        {
          eventType: 'delivered',
          timestamp: new Date().toISOString(),
          recipientEmail,
          messageId: `message-delivered-${token}`,
          providerEventId: `provider-delivered-${token}`,
          eventId: fixtureIds.eventId,
          raw: {
            provider: 'mailtrap',
          },
        },
        {
          eventType: 'bounce',
          timestamp: new Date().toISOString(),
          recipientEmail,
          messageId: `message-bounce-${token}`,
          providerEventId: `provider-bounce-${token}`,
          eventId: fixtureIds.eventId,
          raw: {
            provider: 'mailtrap',
            reason: 'mailbox_not_found',
          },
        },
      ],
    };

    const response = await request(app)
      .post(`${apiPrefix}/webhooks/mailtrap/events`)
      .set(buildMailtrapSignatureHeaders(payload))
      .set('authorization', `Bearer ${n8nWebhookToken}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.ingestedCount).toBe(2);
    expect(response.body.data.returnSignalCount).toBe(1);
    expect(response.body.data.flaggedUserCount).toBe(1);
    expect(response.body.data.flaggedPlayerCount).toBeGreaterThanOrEqual(1);
    expect(response.body.data.auditCount).toBeGreaterThanOrEqual(1);

    const [user, player, events, emailReturnAudit] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: fixtureIds.playerUserId,
        },
        select: {
          hasReturnEmailIssue: true,
        },
      }),
      prisma.player.findUnique({
        where: {
          id: fixtureIds.playerId,
        },
        select: {
          hasReturnEmailIssue: true,
        },
      }),
      prisma.emailEvent.findMany({
        where: {
          recipientEmailNormalized: recipientEmail,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          actionType: 'EMAIL_RETURN_FLAGGED',
          targetId: fixtureIds.playerId,
        },
        select: {
          actorUserId: true,
          actorUser: {
            select: {
              email: true,
            },
          },
        },
      }),
    ]);

    expect(user?.hasReturnEmailIssue).toBe(true);
    expect(player?.hasReturnEmailIssue).toBe(true);
    expect(events).toHaveLength(2);
    expect(emailReturnAudit).not.toBeNull();
    expect(emailReturnAudit?.actorUser.email).toBe(mailtrapAuditActorEmail);
    expect(emailReturnAudit?.actorUserId).not.toBe(fixtureIds.adminUserId);
  });

  it('handles duplicate Mailtrap events idempotently', async () => {
    const recipientEmail = `player-${token}@velocitygp.dev`;
    const duplicatePayload = {
      events: [
        {
          eventType: 'delivered',
          timestamp: new Date().toISOString(),
          recipientEmail,
          messageId: `message-delivered-${token}`,
          providerEventId: `provider-delivered-${token}`,
          eventId: fixtureIds.eventId,
        },
        {
          eventType: 'bounce',
          timestamp: new Date().toISOString(),
          recipientEmail,
          messageId: `message-bounce-${token}`,
          providerEventId: `provider-bounce-${token}`,
          eventId: fixtureIds.eventId,
        },
      ],
    };

    const response = await request(app)
      .post(`${apiPrefix}/webhooks/mailtrap/events`)
      .set(buildMailtrapSignatureHeaders(duplicatePayload))
      .set('authorization', `Bearer ${n8nWebhookToken}`)
      .send(duplicatePayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.ingestedCount).toBe(0);
    expect(response.body.data.duplicateCount).toBe(2);
    expect(response.body.data.auditCount).toBe(0);

    const events = await prisma.emailEvent.findMany({
      where: {
        recipientEmailNormalized: recipientEmail,
      },
    });

    expect(events).toHaveLength(2);
  });

  it('rejects Mailtrap webhook requests when signature is tampered', async () => {
    const payload = {
      events: [
        {
          eventType: 'delivered',
          recipientEmail: `player-${token}@velocitygp.dev`,
          eventId: fixtureIds.eventId,
        },
      ],
    };

    const headers = buildMailtrapSignatureHeaders(payload);

    const response = await request(app)
      .post(`${apiPrefix}/webhooks/mailtrap/events`)
      .set({
        ...headers,
        'x-mailtrap-signature': 'sha256=deadbeef',
      })
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('verifies valid magic links and returns deterministic routing + session payload', async () => {
    const capturedLinks: string[] = [];
    const assignedEmail = `player-${token}@velocitygp.dev`;

    setEmailDispatcherForTests({
      dispatch: async (input) => {
        if (input.templateKey === 'magic_link_login') {
          capturedLinks.push(input.variables['magicLinkUrl'] as string);
        }
      },
    });

    const requestResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: assignedEmail });

    expect(requestResponse.status).toBe(202);
    expect(capturedLinks.length).toBe(1);

    const tokenFromLink = new URL(capturedLinks[0]).searchParams.get('token');
    expect(tokenFromLink).toBeTruthy();
    if (!tokenFromLink) {
      throw new Error('Expected token in captured magic link URL.');
    }

    const verifyResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/verify`)
      .send({ token: tokenFromLink });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.session.userId).toBe(fixtureIds.playerUserId);
    expect(verifyResponse.body.data.session.playerId).toBe(fixtureIds.playerId);
    expect(verifyResponse.body.data.session.assignmentStatus).toBe('ASSIGNED_ACTIVE');
    expect(verifyResponse.body.data.redirectPath).toBe('/race');
    expect(typeof verifyResponse.body.data.sessionToken).toBe('string');

    const setCookieHeader = verifyResponse.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader)).toBe(true);
    expect(setCookieHeader?.[0]).toContain('velocitygp_session=');
    expect(setCookieHeader?.[0]).toContain('Max-Age=432000');
    expect(setCookieHeader?.[0]).toContain('HttpOnly');

    const sessionToken = String(verifyResponse.body.data.sessionToken);
    const sessionCookie = setCookieHeader?.[0]?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const cookieSessionResponse = await request(app)
      .get(`${apiPrefix}/auth/session`)
      .set('cookie', String(sessionCookie));

    expect(cookieSessionResponse.status).toBe(200);
    expect(cookieSessionResponse.body.data.session.playerId).toBe(fixtureIds.playerId);

    const [sessionResponse, routingResponse, identityResponse] = await Promise.all([
      request(app).get(`${apiPrefix}/auth/session`).set('authorization', `Bearer ${sessionToken}`),
      request(app)
        .get(`${apiPrefix}/auth/routing-decision`)
        .set('authorization', `Bearer ${sessionToken}`),
      request(app)
        .get(`${apiPrefix}/events/current/players/me`)
        .set('authorization', `Bearer ${sessionToken}`),
    ]);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.data.session.playerId).toBe(fixtureIds.playerId);
    expect(routingResponse.status).toBe(200);
    expect(routingResponse.body.data.redirectPath).toBe('/race');
    expect(identityResponse.status).toBe(200);
    expect(identityResponse.body.data.playerId).toBe(fixtureIds.playerId);
    expect(identityResponse.body.data.teamStatus).toBe('ACTIVE');
    expect(identityResponse.body.data.pitStopExpiresAt).toBeNull();
  });

  it('falls back to cookie auth when a stale bearer token is also present', async () => {
    const assignedEmail = `player-${token}@velocitygp.dev`;
    const capturedLinks: string[] = [];

    setEmailDispatcherForTests({
      dispatch: async (input) => {
        if (input.templateKey === 'magic_link_login') {
          capturedLinks.push(input.variables['magicLinkUrl'] as string);
        }
      },
    });

    const requestResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: assignedEmail });

    expect(requestResponse.status).toBe(202);
    expect(capturedLinks.length).toBe(1);

    const tokenFromLink = new URL(capturedLinks[0]).searchParams.get('token');
    expect(tokenFromLink).toBeTruthy();
    if (!tokenFromLink) {
      throw new Error('Expected token in captured magic link URL.');
    }

    const verifyResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/verify`)
      .send({ token: tokenFromLink });

    expect(verifyResponse.status).toBe(200);

    const sessionCookie = verifyResponse.headers['set-cookie']?.[0]?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const staleBearerToken = 'stale-bearer-token';

    const [sessionResponse, routingResponse] = await Promise.all([
      request(app)
        .get(`${apiPrefix}/auth/session`)
        .set('authorization', `Bearer ${staleBearerToken}`)
        .set('cookie', String(sessionCookie)),
      request(app)
        .get(`${apiPrefix}/auth/routing-decision`)
        .set('authorization', `Bearer ${staleBearerToken}`)
        .set('cookie', String(sessionCookie)),
    ]);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.data.session.playerId).toBe(fixtureIds.playerId);
    expect(routingResponse.status).toBe(200);
    expect(routingResponse.body.data.redirectPath).toBe('/race');
  });

  it('clears auth cookie on logout and removes cookie-authenticated access', async () => {
    const assignedEmail = `player-${token}@velocitygp.dev`;
    const capturedLinks: string[] = [];

    setEmailDispatcherForTests({
      dispatch: async (input) => {
        if (input.templateKey === 'magic_link_login') {
          capturedLinks.push(input.variables['magicLinkUrl'] as string);
        }
      },
    });

    const requestResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/request`)
      .send({ workEmail: assignedEmail });

    expect(requestResponse.status).toBe(202);
    expect(capturedLinks.length).toBe(1);

    const tokenFromLink = new URL(capturedLinks[0]).searchParams.get('token');
    expect(tokenFromLink).toBeTruthy();
    if (!tokenFromLink) {
      throw new Error('Expected token in captured magic link URL.');
    }

    const agent = request.agent(app);
    const verifyResponse = await agent.post(`${apiPrefix}/auth/magic-link/verify`).send({
      token: tokenFromLink,
    });

    expect(verifyResponse.status).toBe(200);

    const authenticatedSessionResponse = await agent.get(`${apiPrefix}/auth/session`);
    expect(authenticatedSessionResponse.status).toBe(200);

    const logoutResponse = await agent.post(`${apiPrefix}/auth/logout`);
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);
    expect(logoutResponse.body.data.loggedOut).toBe(true);
    expect(logoutResponse.headers['set-cookie']?.[0]).toContain('velocitygp_session=;');

    const postLogoutSessionResponse = await agent.get(`${apiPrefix}/auth/session`);
    expect(postLogoutSessionResponse.status).toBe(401);
    expect(postLogoutSessionResponse.body.success).toBe(false);
    expect(postLogoutSessionResponse.body.error.code).toBe('AUTH_MISSING_TOKEN');
  });

  it('rejects unassigned players during verify with AUTH_ASSIGNMENT_REQUIRED', async () => {
    const tokenForUnassigned = createMagicLinkToken({
      userId: fixtureIds.unassignedUserId,
      playerId: fixtureIds.unassignedPlayerId,
      eventId: fixtureIds.eventId,
      email: `unassigned-${token}@velocitygp.dev`,
    });

    const verifyResponse = await request(app)
      .post(`${apiPrefix}/auth/magic-link/verify`)
      .send({ token: tokenForUnassigned });

    expect(verifyResponse.status).toBe(403);
    expect(verifyResponse.body.success).toBe(false);
    expect(verifyResponse.body.error.code).toBe('AUTH_ASSIGNMENT_REQUIRED');
  });

  it('lists admin roster and supports assignment-status filtering', async () => {
    await prisma.player.update({
      where: {
        id: fixtureIds.unassignedPlayerId,
      },
      data: {
        isFlaggedForReview: true,
      },
    });

    const allRosterResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(allRosterResponse.status).toBe(200);
    expect(allRosterResponse.body.success).toBe(true);
    expect(allRosterResponse.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(allRosterResponse.body.data.items[0]).toHaveProperty('isFlaggedForReview');

    const unassignedResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster`)
      .query({ assignmentStatus: 'UNASSIGNED' })
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(unassignedResponse.status).toBe(200);
    expect(unassignedResponse.body.success).toBe(true);
    expect(unassignedResponse.body.data.items).toHaveLength(1);
    expect(unassignedResponse.body.data.items[0].playerId).toBe(fixtureIds.unassignedPlayerId);
    expect(unassignedResponse.body.data.items[0].assignmentStatus).toBe('UNASSIGNED');

    const flaggedResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster`)
      .query({ isFlaggedForReview: 'true' })
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(flaggedResponse.status).toBe(200);
    expect(flaggedResponse.body.success).toBe(true);
    expect(flaggedResponse.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(
      flaggedResponse.body.data.items.every(
        (item: { isFlaggedForReview: boolean }) => item.isFlaggedForReview
      )
    ).toBe(true);
    expect(
      flaggedResponse.body.data.items.some(
        (item: { playerId: string }) => item.playerId === fixtureIds.unassignedPlayerId
      )
    ).toBe(true);
  });

  it('resolves flagged players through admin review endpoint and records an audit row', async () => {
    await prisma.player.update({
      where: {
        id: fixtureIds.playerId,
      },
      data: {
        isFlaggedForReview: true,
      },
    });

    const response = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/players/${fixtureIds.playerId}/review-flag`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        decision: 'APPROVED',
        reason: 'Confirmed accidental scan and completed review.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.playerId).toBe(fixtureIds.playerId);
    expect(response.body.data.isFlaggedForReview).toBe(false);
    expect(response.body.data.decision).toBe('APPROVED');
    expect(response.body.data.reason).toContain('completed review');
    expect(response.body.data.auditId).toBeTruthy();

    const [player, audit] = await Promise.all([
      prisma.player.findUnique({
        where: {
          id: fixtureIds.playerId,
        },
        select: {
          isFlaggedForReview: true,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          actionType: 'PLAYER_REVIEW_FLAG_RESOLVED',
          targetId: fixtureIds.playerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          details: true,
        },
      }),
    ]);

    expect(player?.isFlaggedForReview).toBe(false);
    expect(audit).not.toBeNull();
    expect(audit?.details).toMatchObject({
      reviewResolution: true,
      decision: 'APPROVED',
    });
  });

  it('updates roster assignments and writes roster audit rows', async () => {
    const response = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/roster/players/${fixtureIds.unassignedPlayerId}/assignment`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ teamId: fixtureIds.secondTeamId, reason: 'seeded test assignment' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.playerId).toBe(fixtureIds.unassignedPlayerId);
    expect(response.body.data.previousTeamId).toBeNull();
    expect(response.body.data.teamId).toBe(fixtureIds.secondTeamId);
    expect(response.body.data.assignmentStatus).toBe('ASSIGNED_PENDING');
    expect(response.body.data.auditId).toBeTruthy();

    const [updatedPlayer, audit] = await Promise.all([
      prisma.player.findUnique({
        where: {
          id: fixtureIds.unassignedPlayerId,
        },
        select: {
          teamId: true,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          actionType: 'ROSTER_ASSIGNED',
          targetId: fixtureIds.unassignedPlayerId,
        },
      }),
    ]);

    expect(updatedPlayer?.teamId).toBe(fixtureIds.secondTeamId);
    expect(audit).not.toBeNull();
  });

  it('previews roster imports with duplicate-email and invalid-phone validation', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster/import/preview`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        rows: [
          {
            workEmail: `dupe-${token}@velocitygp.dev`,
            displayName: 'Dupe One',
          },
          {
            workEmail: `dupe-${token}@velocitygp.dev`,
            displayName: 'Dupe Two',
          },
          {
            workEmail: `invalid-phone-${token}@velocitygp.dev`,
            displayName: 'Invalid Phone',
            phoneE164: '555-0100',
          },
          {
            workEmail: `player-${token}@velocitygp.dev`,
            displayName: 'Player Fixture Updated',
            teamName: `App Pending Team ${token}`,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.total).toBe(4);
    expect(response.body.data.summary.invalid).toBe(3);
    expect(response.body.data.summary.valid).toBe(1);
    expect(response.body.data.rows[3].action).toBe('reassign');
  });

  it('applies roster imports with upsert, assignment preservation, and team auto-create', async () => {
    const newStandaloneEmail = `new-standalone-${token}@velocitygp.dev`;
    const newAssignedEmail = `new-assigned-${token}@velocitygp.dev`;

    const response = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster/import/apply`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        rows: [
          {
            workEmail: newStandaloneEmail,
            displayName: 'Standalone Import',
          },
          {
            workEmail: `player-${token}@velocitygp.dev`,
            displayName: 'Player Fixture Renamed',
          },
          {
            workEmail: `unassigned-${token}@velocitygp.dev`,
            displayName: 'Unassigned Fixture',
            teamName: `App Pending Team ${token}`,
          },
          {
            workEmail: newAssignedEmail,
            displayName: 'New Assigned Import',
            teamName: `New Import Team ${token}`,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.total).toBe(4);
    expect(response.body.data.summary.invalid).toBe(0);
    expect(response.body.data.summary.createdUsers).toBe(2);
    expect(response.body.data.summary.updatedUsers).toBe(1);
    expect(response.body.data.summary.createdPlayers).toBe(2);
    expect(response.body.data.summary.assigned).toBeGreaterThanOrEqual(1);
    expect(response.body.data.summary.createdTeams).toBe(1);

    const [renamedPlayerUser, preservedPlayer, newlyAssignedUnassigned, createdTeam, importAudit] =
      await Promise.all([
        prisma.user.findUnique({
          where: {
            email: `player-${token}@velocitygp.dev`,
          },
          select: {
            displayName: true,
          },
        }),
        prisma.player.findUnique({
          where: {
            id: fixtureIds.playerId,
          },
          select: {
            teamId: true,
          },
        }),
        prisma.player.findUnique({
          where: {
            id: fixtureIds.unassignedPlayerId,
          },
          select: {
            teamId: true,
          },
        }),
        prisma.team.findFirst({
          where: {
            eventId: fixtureIds.eventId,
            name: `New Import Team ${token}`,
          },
          select: {
            id: true,
          },
        }),
        prisma.adminActionAudit.findFirst({
          where: {
            eventId: fixtureIds.eventId,
            actionType: 'ROSTER_IMPORTED',
          },
        }),
      ]);

    expect(renamedPlayerUser?.displayName).toBe('Player Fixture Renamed');
    expect(preservedPlayer?.teamId).toBe(fixtureIds.teamId);
    expect(newlyAssignedUnassigned?.teamId).toBe(fixtureIds.secondTeamId);
    expect(createdTeam).not.toBeNull();
    expect(importAudit).not.toBeNull();
  });

  it('returns team detail with team rank and member rankings', async () => {
    await Promise.all([
      prisma.team.update({
        where: {
          id: fixtureIds.teamId,
        },
        data: {
          deletedAt: null,
          status: 'ACTIVE',
          score: 1200,
          pitStopExpiresAt: null,
        },
      }),
      prisma.team.update({
        where: {
          id: fixtureIds.secondTeamId,
        },
        data: {
          deletedAt: null,
          status: 'ACTIVE',
          score: 900,
          pitStopExpiresAt: null,
        },
      }),
      prisma.player.update({
        where: {
          id: fixtureIds.playerId,
        },
        data: {
          teamId: fixtureIds.teamId,
          individualScore: 340,
        },
      }),
      prisma.player.update({
        where: {
          id: fixtureIds.unassignedPlayerId,
        },
        data: {
          teamId: fixtureIds.teamId,
          individualScore: 180,
        },
      }),
    ]);

    const response = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/teams/${fixtureIds.teamId}/detail`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.teamId).toBe(fixtureIds.teamId);
    expect(response.body.data.rank).toBe(1);
    expect(response.body.data.memberCount).toBeGreaterThanOrEqual(2);
    expect(response.body.data.members[0].playerId).toBe(fixtureIds.playerId);
    expect(response.body.data.members[0].rank).toBe(1);
    expect(response.body.data.members[1].playerId).toBe(fixtureIds.unassignedPlayerId);
    expect(response.body.data.members[1].rank).toBe(2);
  });

  it('updates team score and records TEAM_SCORE_UPDATED audits', async () => {
    const response = await request(app)
      .patch(`${apiPrefix}/admin/events/${fixtureIds.eventId}/teams/${fixtureIds.teamId}/score`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ score: 1777, reason: 'manual correction' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.teamId).toBe(fixtureIds.teamId);
    expect(response.body.data.score).toBe(1777);
    expect(response.body.data.auditId).toBeTruthy();

    const [team, audit] = await Promise.all([
      prisma.team.findUnique({
        where: {
          id: fixtureIds.teamId,
        },
        select: {
          score: true,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          targetId: fixtureIds.teamId,
          actionType: 'TEAM_SCORE_UPDATED',
        },
      }),
    ]);

    expect(team?.score).toBe(1777);
    expect(audit).not.toBeNull();
  });

  it('returns player detail, updates contact, and lists full scan-history outcomes', async () => {
    const updatedEmail = `player-detail-${token}@velocitygp.dev`;
    const updatedPhone = '+14155550199';
    const now = Date.now();

    await prisma.team.update({
      where: {
        id: fixtureIds.teamId,
      },
      data: {
        deletedAt: null,
      },
    });

    await prisma.player.updateMany({
      where: {
        eventId: fixtureIds.eventId,
      },
      data: {
        individualScore: 10,
      },
    });

    await prisma.player.update({
      where: {
        id: fixtureIds.playerId,
      },
      data: {
        teamId: fixtureIds.teamId,
        individualScore: 500,
        isFlaggedForReview: true,
      },
    });

    await prisma.player.update({
      where: {
        id: fixtureIds.unassignedPlayerId,
      },
      data: {
        teamId: fixtureIds.teamId,
        individualScore: 250,
      },
    });

    await prisma.scanRecord.deleteMany({
      where: {
        eventId: fixtureIds.eventId,
        playerId: fixtureIds.playerId,
      },
    });

    await prisma.scanRecord.createMany({
      data: [
        {
          eventId: fixtureIds.eventId,
          playerId: fixtureIds.playerId,
          teamId: fixtureIds.teamId,
          qrCodeId: fixtureIds.qrCodeId,
          outcome: 'SAFE',
          pointsAwarded: 120,
          scannedPayload: `${fixtureIds.qrPayload}-SAFE`,
          message: 'safe',
          createdAt: new Date(now - 60_000),
        },
        {
          eventId: fixtureIds.eventId,
          playerId: fixtureIds.playerId,
          teamId: fixtureIds.teamId,
          qrCodeId: fixtureIds.qrCodeId,
          outcome: 'HAZARD_PIT',
          pointsAwarded: 0,
          scannedPayload: `${fixtureIds.qrPayload}-HAZARD`,
          message: 'hazard',
          createdAt: new Date(now - 45_000),
        },
        {
          eventId: fixtureIds.eventId,
          playerId: fixtureIds.playerId,
          teamId: fixtureIds.teamId,
          qrCodeId: null,
          outcome: 'INVALID',
          pointsAwarded: -1,
          scannedPayload: 'invalid-payload',
          message: 'invalid',
          createdAt: new Date(now - 30_000),
        },
        {
          eventId: fixtureIds.eventId,
          playerId: fixtureIds.playerId,
          teamId: fixtureIds.teamId,
          qrCodeId: fixtureIds.qrCodeId,
          outcome: 'DUPLICATE',
          pointsAwarded: 0,
          scannedPayload: `${fixtureIds.qrPayload}-DUP`,
          message: 'duplicate',
          createdAt: new Date(now - 15_000),
        },
        {
          eventId: fixtureIds.eventId,
          playerId: fixtureIds.playerId,
          teamId: fixtureIds.teamId,
          qrCodeId: fixtureIds.qrCodeId,
          outcome: 'BLOCKED',
          pointsAwarded: 0,
          scannedPayload: `${fixtureIds.qrPayload}-BLOCK`,
          message: 'blocked',
          createdAt: new Date(now - 5_000),
        },
      ],
    });

    const detailResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/players/${fixtureIds.playerId}/detail`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data.playerId).toBe(fixtureIds.playerId);
    expect(detailResponse.body.data.globalRank).toBe(1);
    expect(detailResponse.body.data.teamRank).toBe(1);
    expect(detailResponse.body.data.teamId).toBe(fixtureIds.teamId);
    expect(detailResponse.body.data.isFlaggedForReview).toBe(true);

    const contactResponse = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/players/${fixtureIds.playerId}/contact`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        workEmail: updatedEmail,
        phoneE164: updatedPhone,
        reason: 'detail-view edit',
      });

    expect(contactResponse.status).toBe(200);
    expect(contactResponse.body.success).toBe(true);
    expect(contactResponse.body.data.workEmail).toBe(updatedEmail);
    expect(contactResponse.body.data.phoneE164).toBe(updatedPhone);
    expect(contactResponse.body.data.auditId).toBeTruthy();

    const scanHistoryResponse = await request(app)
      .get(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/players/${fixtureIds.playerId}/scan-history`
      )
      .query({ limit: 10 })
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(scanHistoryResponse.status).toBe(200);
    expect(scanHistoryResponse.body.success).toBe(true);
    expect(scanHistoryResponse.body.data.items).toHaveLength(5);
    expect(scanHistoryResponse.body.data.items[0].outcome).toBe('BLOCKED');
    expect(scanHistoryResponse.body.data.items[1].outcome).toBe('DUPLICATE');
    expect(scanHistoryResponse.body.data.items[2].outcome).toBe('INVALID');
    expect(scanHistoryResponse.body.data.items[3].outcome).toBe('HAZARD_PIT');
    expect(scanHistoryResponse.body.data.items[4].outcome).toBe('SAFE');
    expect(scanHistoryResponse.body.data.items[0].qrCodeLabel).toContain(`App QR ${token}`);
  });

  it('soft-deletes teams, unassigns members, and excludes deleted teams from admin roster surfaces', async () => {
    const deletableTeamId = `team-delete-${token}`;
    const deletableUserId = `user-delete-${token}`;
    const deletablePlayerId = `player-delete-${token}`;

    await prisma.user.create({
      data: {
        id: deletableUserId,
        email: `team-delete-${token}@velocitygp.dev`,
        displayName: 'Delete Candidate',
        role: 'PLAYER',
      },
    });

    await prisma.team.create({
      data: {
        id: deletableTeamId,
        eventId: fixtureIds.eventId,
        name: `Delete Team ${token}`,
        status: 'IN_PIT',
      },
    });

    await prisma.player.create({
      data: {
        id: deletablePlayerId,
        userId: deletableUserId,
        eventId: fixtureIds.eventId,
        teamId: deletableTeamId,
        status: 'IN_PIT',
      },
    });

    const deleteResponse = await request(app)
      .delete(`${apiPrefix}/admin/events/${fixtureIds.eventId}/teams/${deletableTeamId}`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(deleteResponse.body.data.teamId).toBe(deletableTeamId);
    expect(deleteResponse.body.data.unassignedPlayerCount).toBe(1);

    const [deletedTeam, affectedPlayer, rosterTeamsResponse, deletedDetailResponse] =
      await Promise.all([
        prisma.team.findUnique({
          where: {
            id: deletableTeamId,
          },
          select: {
            deletedAt: true,
          },
        }),
        prisma.player.findUnique({
          where: {
            id: deletablePlayerId,
          },
          select: {
            teamId: true,
            status: true,
          },
        }),
        request(app)
          .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster/teams`)
          .set('x-user-id', fixtureIds.adminUserId)
          .set('x-user-role', 'admin'),
        request(app)
          .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/teams/${deletableTeamId}/detail`)
          .set('x-user-id', fixtureIds.adminUserId)
          .set('x-user-role', 'admin'),
      ]);

    expect(deletedTeam?.deletedAt).not.toBeNull();
    expect(affectedPlayer?.teamId).toBeNull();
    expect(affectedPlayer?.status).toBe('RACING');
    expect(rosterTeamsResponse.status).toBe(200);
    expect(
      (rosterTeamsResponse.body.data.teams as Array<{ teamId: string }>).some(
        (team) => team.teamId === deletableTeamId
      )
    ).toBe(false);
    expect(deletedDetailResponse.status).toBe(400);
    expect(deletedDetailResponse.body.success).toBe(false);
  });

  it('rejects admin routes when authentication context is missing', async () => {
    const response = await request(app).get(`${apiPrefix}/admin/session`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects admin routes when authenticated user is not an admin', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/session`)
      .set('x-user-id', 'player-1')
      .set('x-user-role', 'player');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin access for protected admin routes', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/session`)
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.scope).toBe('admin');
    expect(response.body.data.userId).toBe('admin-1');
    expect(response.body.data.role).toBe('admin');
  });

  it('keeps non-admin event routes unaffected by admin middleware enforcement', async () => {
    const unauthenticatedResponse = await request(app).get(`${apiPrefix}/events/current`);
    const playerHeaderResponse = await request(app)
      .get(`${apiPrefix}/events/current`)
      .set('x-user-id', fixtureIds.playerUserId)
      .set('x-user-role', 'player');
    const adminHeaderResponse = await request(app)
      .get(`${apiPrefix}/events/current`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(unauthenticatedResponse.status).toBe(200);
    expect(playerHeaderResponse.status).toBe(200);
    expect(adminHeaderResponse.status).toBe(200);

    expect(unauthenticatedResponse.body.success).toBe(true);
    expect(playerHeaderResponse.body.success).toBe(true);
    expect(adminHeaderResponse.body.success).toBe(true);

    expect(playerHeaderResponse.body.data.id).toBe(unauthenticatedResponse.body.data.id);
    expect(adminHeaderResponse.body.data.id).toBe(unauthenticatedResponse.body.data.id);
  });

  it('updates user capabilities through the unified admin endpoint', async () => {
    try {
      const response = await request(app)
        .post(`${apiPrefix}/admin/users/${fixtureIds.playerUserId}/capabilities`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({
          capabilities: {
            admin: true,
            player: true,
            heliosMember: true,
          },
          reason: 'promoted for event operations',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(fixtureIds.playerUserId);
      expect(response.body.data.capabilities).toEqual({
        admin: true,
        player: true,
        heliosMember: true,
      });

      const [user, audit] = await Promise.all([
        prisma.user.findUnique({
          where: {
            id: fixtureIds.playerUserId,
          },
          select: {
            canAdmin: true,
            canPlayer: true,
            isHeliosMember: true,
          },
        }),
        prisma.adminActionAudit.findFirst({
          where: {
            targetId: fixtureIds.playerUserId,
            actionType: 'HELIOS_ASSIGNED',
          },
        }),
      ]);

      expect(user).toMatchObject({
        canAdmin: true,
        canPlayer: true,
        isHeliosMember: true,
      });
      expect(audit).not.toBeNull();
    } finally {
      await prisma.user.update({
        where: {
          id: fixtureIds.playerUserId,
        },
        data: {
          role: 'PLAYER',
          canAdmin: false,
          canPlayer: true,
          isHeliosMember: false,
          isHelios: false,
        },
      });
    }
  });

  it('rejects capability updates that disable both admin and player access', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/users/${fixtureIds.playerUserId}/capabilities`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        capabilities: {
          admin: false,
          player: false,
          heliosMember: false,
        },
        reason: 'attempt invalid disable',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects capability updates when heliosMember is true without player capability', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/users/${fixtureIds.playerUserId}/capabilities`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        capabilities: {
          admin: true,
          player: false,
          heliosMember: true,
        },
        reason: 'attempt invalid helios-only membership',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows legacy admin headers when a stale non-admin session cookie is present', async () => {
    const stalePlayerSessionToken = createSessionToken({
      userId: fixtureIds.playerUserId,
      playerId: fixtureIds.playerId,
      eventId: fixtureIds.eventId,
      teamId: fixtureIds.teamId,
      teamStatus: 'ACTIVE',
      role: 'player',
      email: `player-${token}@velocitygp.dev`,
      displayName: 'Player Fixture',
    });

    const response = await request(app)
      .get(`${apiPrefix}/admin/session`)
      .set('Cookie', `${AUTH_SESSION_COOKIE_NAME}=${stalePlayerSessionToken}`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.scope).toBe('admin');
    expect(response.body.data.userId).toBe(fixtureIds.adminUserId);
    expect(response.body.data.role).toBe('admin');
  });

  it('updates race control through admin endpoints', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/race-control`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ state: 'PAUSED', reason: 'scheduled break' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.eventId).toBe(fixtureIds.eventId);
    expect(response.body.data.state).toBe('PAUSED');
    expect(response.body.data.auditId).toBeTruthy();
  });

  it('reads race control state through admin endpoints', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/race-control`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.eventId).toBe(fixtureIds.eventId);
    expect(response.body.data.state).toBe('PAUSED');
  });

  it('blocks scans with RACE_PAUSED while race control is paused', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/events/${fixtureIds.eventId}/scans`)
      .set('authorization', createPlayerSessionAuthHeader())
      .send({ playerId: fixtureIds.playerId, qrPayload: fixtureIds.qrPayload });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.outcome).toBe('BLOCKED');
    expect(response.body.data.errorCode).toBe('RACE_PAUSED');
  });

  it('updates helios role and records HELIOS audit entries', async () => {
    const assignResponse = await request(app)
      .post(`${apiPrefix}/admin/users/${fixtureIds.playerUserId}/helios-role`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ isHelios: true, reason: 'staffing shift' });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.success).toBe(true);
    expect(assignResponse.body.data.userId).toBe(fixtureIds.playerUserId);
    expect(assignResponse.body.data.isHelios).toBe(true);
    expect(assignResponse.body.data.auditId).toBeTruthy();

    const revokeResponse = await request(app)
      .post(`${apiPrefix}/admin/users/${fixtureIds.playerUserId}/helios-role`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ isHelios: false, reason: 'shift complete' });

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.success).toBe(true);
    expect(revokeResponse.body.data.isHelios).toBe(false);

    const [updatedUser, assignedAudit, revokedAudit] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: fixtureIds.playerUserId,
        },
        select: {
          isHelios: true,
          role: true,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          actionType: 'HELIOS_ASSIGNED',
          targetId: fixtureIds.playerUserId,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          actionType: 'HELIOS_REVOKED',
          targetId: fixtureIds.playerUserId,
        },
      }),
    ]);

    expect(updatedUser?.isHelios).toBe(false);
    expect(updatedUser?.role).toBe('PLAYER');
    expect(assignedAudit).not.toBeNull();
    expect(revokedAudit).not.toBeNull();
  });

  it('lists race-control and helios actions in admin audit feed', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/audits`)
      .query({ limit: 100 })
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const actionTypes = (response.body.data.items as Array<{ actionType: string }>).map(
      (item) => item.actionType
    );

    expect(actionTypes).toContain('RACE_PAUSED');
    expect(actionTypes).toContain('HELIOS_ASSIGNED');
    expect(actionTypes).toContain('HELIOS_REVOKED');

    // Restore ACTIVE state so downstream scan tests in this suite stay unblocked.
    const resumeResponse = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/race-control`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ state: 'ACTIVE', reason: 'test suite resume' });

    expect(resumeResponse.status).toBe(200);
    expect(resumeResponse.body.success).toBe(true);
    expect(resumeResponse.body.data.state).toBe('ACTIVE');
  });

  it('creates QR inventory entries and generates downloadable assets via n8n webhook', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          qrImageURL: 'https://cdn.velocitygp.app/qr/new-code.png',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    try {
      const response = await request(app)
        .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({
          label: `Generated QR ${token}`,
          value: 160,
          zone: 'North Ramp',
          activationStartsAt: '2026-04-06T10:15:00.000Z',
          activationEndsAt: '2026-04-06T17:15:00.000Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eventId).toBe(fixtureIds.eventId);
      expect(response.body.data.qrCode.status).toBe('ACTIVE');
      expect(response.body.data.qrCode.zone).toBe('North Ramp');
      expect(response.body.data.qrCode.qrImageUrl).toBe(
        'https://cdn.velocitygp.app/qr/new-code.png'
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toContain('/webhook/dev/QRCodeGen');
      const generationBody = JSON.parse(String(calledInit.body)) as { id: string; url: string };
      expect(generationBody.id).toBe(response.body.data.qrCode.id);
      expect(generationBody.url).toContain('/scan/');

      const persisted = await prisma.qRCode.findUnique({
        where: {
          id: response.body.data.qrCode.id,
        },
        select: {
          qrImageUrl: true,
          deletedAt: true,
        },
      });
      expect(persisted?.qrImageUrl).toBe('https://cdn.velocitygp.app/qr/new-code.png');
      expect(persisted?.deletedAt).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('returns validation error when admin creates a duplicate QR label', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          qrImageURL: 'https://cdn.velocitygp.app/qr/duplicate.png',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    try {
      const response = await request(app)
        .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({
          label: `App QR ${token}`,
          value: 120,
          zone: 'North Ramp',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('already exists');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('updates per-QR hazard randomizer weight through admin endpoints', async () => {
    const response = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/${fixtureIds.qrCodeId}/hazard-randomizer`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ hazardWeightOverride: 80, hazardRatioOverride: 7 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.eventId).toBe(fixtureIds.eventId);
    expect(response.body.data.qrCodeId).toBe(fixtureIds.qrCodeId);
    expect(response.body.data.hazardWeightOverride).toBe(80);
    expect(response.body.data.hazardRatioOverride).toBe(7);

    const [qrCode, audit] = await Promise.all([
      prisma.qRCode.findUnique({
        where: {
          id: fixtureIds.qrCodeId,
        },
        select: {
          hazardRatioOverride: true,
          hazardWeightOverride: true,
        },
      }),
      prisma.adminActionAudit.findFirst({
        where: {
          eventId: fixtureIds.eventId,
          targetId: fixtureIds.qrCodeId,
          actionType: 'QR_HAZARD_RANDOMIZER_UPDATED',
        },
      }),
    ]);

    expect(qrCode?.hazardRatioOverride).toBe(7);
    expect(qrCode?.hazardWeightOverride).toBe(80);
    expect(audit).not.toBeNull();
  });

  it('validates per-QR hazard randomizer payload bounds and integer format', async () => {
    for (const invalidWeight of [101, -1, 12.5]) {
      const response = await request(app)
        .patch(
          `${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/${fixtureIds.qrCodeId}/hazard-randomizer`
        )
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({ hazardWeightOverride: invalidWeight });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('reads and updates global hazard settings through admin endpoints', async () => {
    const beforeResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-settings`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(beforeResponse.status).toBe(200);
    expect(beforeResponse.body.success).toBe(true);
    expect(beforeResponse.body.data.globalHazardRatio).toBe(99);

    const updateResponse = await request(app)
      .patch(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-settings`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ globalHazardRatio: 23, reason: 'balance tuning' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.globalHazardRatio).toBe(23);

    const persisted = await prisma.eventConfig.findUnique({
      where: {
        eventId: fixtureIds.eventId,
      },
      select: {
        globalHazardRatio: true,
      },
    });
    expect(persisted?.globalHazardRatio).toBe(23);
  });

  it('creates, updates, lists, and deletes scheduled hazard multiplier rules', async () => {
    const createResponse = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-multipliers`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        name: 'Lunch Rush',
        startsAt: '2026-04-06T12:00:00.000Z',
        endsAt: '2026-04-06T13:00:00.000Z',
        ratioMultiplier: 0.5,
      });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);
    const ruleId = String(createResponse.body.data.rule.id);

    const listResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-multipliers`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(
      (listResponse.body.data.rules as Array<{ id: string }>).some((item) => item.id === ruleId)
    ).toBe(true);

    const updateResponse = await request(app)
      .patch(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-multipliers/${ruleId}`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ ratioMultiplier: 0.7 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.rule.ratioMultiplier).toBeCloseTo(0.7, 5);

    const deleteResponse = await request(app)
      .delete(`${apiPrefix}/admin/events/${fixtureIds.eventId}/hazard-multipliers/${ruleId}`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
  });

  it('previews and applies QR import rows with row-level errors', async () => {
    const previewResponse = await request(app)
      .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/import/preview`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({
        rows: [
          {
            label: `Import QR ${token}`,
            value: 110,
            zone: 'South Wing',
            hazardRatioOverride: 4,
            hazardWeightOverride: 20,
          },
          {
            label: `App QR ${token}`,
            value: 120,
          },
        ],
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.success).toBe(true);
    expect(previewResponse.body.data.summary.total).toBe(2);
    expect(previewResponse.body.data.summary.invalid).toBe(1);
    expect(previewResponse.body.data.rows[1].errors.length).toBeGreaterThan(0);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          qrImageURL: 'https://cdn.velocitygp.app/qr/imported-code.png',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    try {
      const applyResponse = await request(app)
        .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/import/apply`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({
          rows: [
            {
              label: `Import QR ${token}`,
              value: 110,
              zone: 'South Wing',
              hazardRatioOverride: 4,
              hazardWeightOverride: 20,
            },
          ],
        });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body.success).toBe(true);
      expect(applyResponse.body.data.summary.created).toBe(1);
      expect((applyResponse.body.data.createdQrCodeIds as string[]).length).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('exports QR assets as a ZIP payload with manifest', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/webhook/')) {
        return new Response(
          JSON.stringify({ qrImageURL: 'https://cdn.velocitygp.app/qr/export-ready.png' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
      return new Response('PNGDATA', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });

    try {
      const response = await request(app)
        .post(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/export`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.mimeType).toBe('application/zip');
      expect(typeof response.body.data.archiveBase64).toBe('string');
      expect(response.body.data.archiveBase64.length).toBeGreaterThan(100);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('updates QR status through admin endpoints', async () => {
    const response = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/${fixtureIds.qrCodeId}/status`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ status: 'DISABLED', reason: 'leaked code' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('DISABLED');

    const persisted = await prisma.qRCode.findUnique({
      where: { id: fixtureIds.qrCodeId },
      select: { status: true },
    });
    expect(persisted?.status).toBe('DISABLED');
  });

  it('soft-deletes QR codes from admin inventory without removing historical rows', async () => {
    const response = await request(app)
      .delete(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/${fixtureIds.qrCodeId}`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.qrCodeId).toBe(fixtureIds.qrCodeId);

    const [persisted, inventory] = await Promise.all([
      prisma.qRCode.findUnique({
        where: { id: fixtureIds.qrCodeId },
        select: { deletedAt: true, status: true },
      }),
      request(app)
        .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes`)
        .set('x-user-id', fixtureIds.adminUserId)
        .set('x-user-role', 'admin'),
    ]);

    expect(persisted?.deletedAt).not.toBeNull();
    expect(persisted?.status).toBe('DISABLED');
    expect(inventory.status).toBe(200);
    const inventoryIds = (inventory.body.data.qrCodes as Array<{ id: string }>).map(
      (item) => item.id
    );
    expect(inventoryIds).not.toContain(fixtureIds.qrCodeId);
  });

  it('validates admin payloads for manual pit control', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/events/event-123/teams/team-1/pit-control`)
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'admin')
      .send({ action: 'INVALID_ACTION' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // Helios Superpower QR
  // ---------------------------------------------------------------------------

  it('provisions and returns a Superpower QR for a Helios user on first access', async () => {
    const upstreamFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/webhook/')) {
        return new Response(
          JSON.stringify({ qrImageURL: 'https://cdn.velocitygp.app/qr/superpower-test.png' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return upstreamFetch(input, init);
    });

    try {
      const response = await request(app)
        .get(`${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr`)
        .set('x-user-id', fixtureIds.heliosUserId)
        .set('x-user-role', 'helios');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.asset.qrImageUrl).toBe(
        'https://cdn.velocitygp.app/qr/superpower-test.png'
      );
      expect(response.body.data.asset.status).toBe('ACTIVE');
      expect(typeof response.body.data.asset.payload).toBe('string');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('returns the same active Superpower QR on repeat requests', async () => {
    // No fetch mock needed — asset was provisioned in prior test and should be returned from DB.
    const [first, second] = await Promise.all([
      request(app)
        .get(`${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr`)
        .set('x-user-id', fixtureIds.heliosUserId)
        .set('x-user-role', 'helios'),
      request(app)
        .get(`${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr`)
        .set('x-user-id', fixtureIds.heliosUserId)
        .set('x-user-role', 'helios'),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.asset.id).toBe(second.body.data.asset.id);
  });

  it('regenerates the Superpower QR and revokes the previous one', async () => {
    const upstreamFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/webhook/')) {
        return new Response(
          JSON.stringify({ qrImageURL: 'https://cdn.velocitygp.app/qr/superpower-regen.png' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return upstreamFetch(input, init);
    });

    try {
      // Capture the current asset ID before regeneration.
      const beforeResponse = await request(app)
        .get(`${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr`)
        .set('x-user-id', fixtureIds.heliosUserId)
        .set('x-user-role', 'helios');
      const oldAssetId = beforeResponse.body.data.asset.id as string;

      const regenResponse = await request(app)
        .post(`${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr/regenerate`)
        .set('x-user-id', fixtureIds.heliosUserId)
        .set('x-user-role', 'helios');

      expect(regenResponse.status).toBe(200);
      expect(regenResponse.body.success).toBe(true);
      expect(regenResponse.body.data.asset.status).toBe('ACTIVE');
      expect(regenResponse.body.data.asset.id).not.toBe(oldAssetId);
      expect(regenResponse.body.data.revokedAssetId).toBe(oldAssetId);
      expect(regenResponse.body.data.asset.qrImageUrl).toBe(
        'https://cdn.velocitygp.app/qr/superpower-regen.png'
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('rejects a non-Helios player requesting a Superpower QR', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/players/${fixtureIds.playerId}/superpower-qr`)
      .set('x-user-id', fixtureIds.playerUserId)
      .set('x-user-role', 'player');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('rejects an unauthenticated request for a Superpower QR', async () => {
    const response = await request(app).get(
      `${apiPrefix}/players/${fixtureIds.heliosPlayerId}/superpower-qr`
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('rejects a Helios user from accessing another player Superpower QR', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/players/${fixtureIds.playerId}/superpower-qr`)
      .set('x-user-id', fixtureIds.heliosUserId)
      .set('x-user-role', 'helios');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
