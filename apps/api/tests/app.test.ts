import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/db/client.js';

describe('velocity gp backend', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;
  const token = randomUUID().slice(0, 8);
  const fixtureIds = {
    eventId: `event-app-${token}`,
    teamId: `team-app-${token}`,
    playerId: `player-app-${token}`,
    playerUserId: `user-player-app-${token}`,
    adminUserId: `user-admin-app-${token}`,
    qrCodeId: `qr-app-${token}`,
    qrPayload: `VG-APP-${token.toUpperCase()}`,
  };

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
          id: fixtureIds.playerUserId,
          email: `player-${token}@velocitygp.dev`,
          displayName: 'Player Fixture',
          role: 'PLAYER',
          isHelios: false,
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

    await prisma.team.create({
      data: {
        id: fixtureIds.teamId,
        eventId: fixtureIds.eventId,
        name: `App Team ${token}`,
        score: 0,
        status: 'ACTIVE',
      },
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
    await prisma.event.deleteMany({
      where: {
        id: fixtureIds.eventId,
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fixtureIds.adminUserId, fixtureIds.playerUserId],
        },
      },
    });
  });

  it('returns health information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('velocity-gp-bff');
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
      .send({ playerId: fixtureIds.playerId, qrPayload: fixtureIds.qrPayload });

    expect(safeResponse.status).toBe(200);
    expect(safeResponse.body.success).toBe(true);
    expect(safeResponse.body.data.outcome).toBe('SAFE');
    expect(safeResponse.body.data.pointsAwarded).toBeGreaterThan(0);
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
  });

  it('validates request bodies', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/players`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
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
  });

  it('updates per-QR hazard randomizer weight through admin endpoints', async () => {
    const response = await request(app)
      .patch(
        `${apiPrefix}/admin/events/${fixtureIds.eventId}/qr-codes/${fixtureIds.qrCodeId}/hazard-randomizer`
      )
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin')
      .send({ hazardWeightOverride: 80 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.eventId).toBe(fixtureIds.eventId);
    expect(response.body.data.qrCodeId).toBe(fixtureIds.qrCodeId);
    expect(response.body.data.hazardWeightOverride).toBe(80);

    const [qrCode, audit] = await Promise.all([
      prisma.qRCode.findUnique({
        where: {
          id: fixtureIds.qrCodeId,
        },
        select: {
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
});
