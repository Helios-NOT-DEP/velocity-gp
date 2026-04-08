import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/db/client.js';
import { setMagicLinkEmailSenderForTests } from '../src/services/authService.js';
import { createMagicLinkToken } from '../src/services/authTokens.js';

describe('velocity gp backend', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;
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
        {
          id: fixtureIds.unassignedUserId,
          email: `unassigned-${token}@velocitygp.dev`,
          displayName: 'Unassigned Fixture',
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
        email: {
          endsWith: `${token}@velocitygp.dev`,
        },
      },
    });
    setMagicLinkEmailSenderForTests(null);
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

  it('returns non-enumerating magic-link responses for assigned, unknown, and unassigned emails', async () => {
    const assignedEmail = `player-${token}@velocitygp.dev`;
    const unknownEmail = `unknown-${token}@velocitygp.dev`;
    const unassignedEmail = `unassigned-${token}@velocitygp.dev`;
    const capturedLinks: string[] = [];

    setMagicLinkEmailSenderForTests(async (input) => {
      capturedLinks.push(input.magicLinkUrl);
    });

    const [assignedResponse, unknownResponse, unassignedResponse] = await Promise.all([
      request(app).post(`${apiPrefix}/auth/magic-link/request`).send({ workEmail: assignedEmail }),
      request(app).post(`${apiPrefix}/auth/magic-link/request`).send({ workEmail: unknownEmail }),
      request(app)
        .post(`${apiPrefix}/auth/magic-link/request`)
        .send({ workEmail: unassignedEmail }),
    ]);

    expect(assignedResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(202);
    expect(unassignedResponse.status).toBe(202);
    expect(assignedResponse.body.data.accepted).toBe(true);
    expect(unknownResponse.body.data.accepted).toBe(true);
    expect(unassignedResponse.body.data.accepted).toBe(true);
    expect(assignedResponse.body.data.message).toBe(unknownResponse.body.data.message);
    expect(unassignedResponse.body.data.message).toBe(unknownResponse.body.data.message);
    expect(capturedLinks.length).toBe(1);
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

    const response = await request(app).post(`${apiPrefix}/webhooks/mailtrap/events`).send(payload);

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
      }),
    ]);

    expect(user?.hasReturnEmailIssue).toBe(true);
    expect(player?.hasReturnEmailIssue).toBe(true);
    expect(events).toHaveLength(2);
    expect(emailReturnAudit).not.toBeNull();
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

  it('verifies valid magic links and returns deterministic routing + session payload', async () => {
    const capturedLinks: string[] = [];
    const assignedEmail = `player-${token}@velocitygp.dev`;

    setMagicLinkEmailSenderForTests(async (input) => {
      capturedLinks.push(input.magicLinkUrl);
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
    expect(verifyResponse.body.data.redirectPath).toBe('/race-hub');
    expect(typeof verifyResponse.body.data.sessionToken).toBe('string');

    const sessionToken = String(verifyResponse.body.data.sessionToken);
    const [sessionResponse, routingResponse] = await Promise.all([
      request(app).get(`${apiPrefix}/auth/session`).set('authorization', `Bearer ${sessionToken}`),
      request(app)
        .get(`${apiPrefix}/auth/routing-decision`)
        .set('authorization', `Bearer ${sessionToken}`),
    ]);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.data.session.playerId).toBe(fixtureIds.playerId);
    expect(routingResponse.status).toBe(200);
    expect(routingResponse.body.data.redirectPath).toBe('/race-hub');
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
    const allRosterResponse = await request(app)
      .get(`${apiPrefix}/admin/events/${fixtureIds.eventId}/roster`)
      .set('x-user-id', fixtureIds.adminUserId)
      .set('x-user-role', 'admin');

    expect(allRosterResponse.status).toBe(200);
    expect(allRosterResponse.body.success).toBe(true);
    expect(allRosterResponse.body.data.items.length).toBeGreaterThanOrEqual(2);

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
