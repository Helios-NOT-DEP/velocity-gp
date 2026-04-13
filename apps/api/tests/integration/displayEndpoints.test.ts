import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/createApp.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/client.js';

interface DisplayFixture {
  readonly eventId: string;
  readonly userIds: readonly string[];
  readonly teamIds: {
    readonly alpha: string;
    readonly bravo: string;
    readonly charlie: string;
  };
  readonly pitStopExpiresAtIso: string;
  readonly transitionTimes: {
    readonly hazardTriggered: string;
    readonly timerExpired: string;
    readonly adminManual: string;
    readonly rescueCleared: string;
    readonly systemReset: string;
  };
}

async function createDisplayFixture(): Promise<DisplayFixture> {
  const token = randomUUID().slice(0, 8);
  const eventId = `event-display-${token}`;
  const userIds = [
    `user-display-a-${token}`,
    `user-display-b-${token}`,
    `user-display-c-${token}`,
  ] as const;
  const teamIds = {
    alpha: `team-display-alpha-${token}`,
    bravo: `team-display-bravo-${token}`,
    charlie: `team-display-charlie-${token}`,
  } as const;

  const now = new Date();
  const pitStopExpiresAt = new Date(Date.UTC(2030, 3, 13, 2, 15, 0));

  const transitionTimes = {
    hazardTriggered: new Date(Date.UTC(2030, 3, 13, 2, 0, 1)),
    timerExpired: new Date(Date.UTC(2030, 3, 13, 2, 0, 2)),
    adminManual: new Date(Date.UTC(2030, 3, 13, 2, 0, 3)),
    rescueCleared: new Date(Date.UTC(2030, 3, 13, 2, 0, 4)),
    systemReset: new Date(Date.UTC(2030, 3, 13, 2, 0, 5)),
  } as const;

  await prisma.user.createMany({
    data: [
      {
        id: userIds[0],
        email: `display-a-${token}@velocitygp.dev`,
        displayName: 'Display Alpha Driver',
        role: 'PLAYER',
        isHelios: false,
      },
      {
        id: userIds[1],
        email: `display-b-${token}@velocitygp.dev`,
        displayName: 'Display Bravo Driver',
        role: 'PLAYER',
        isHelios: false,
      },
      {
        id: userIds[2],
        email: `display-c-${token}@velocitygp.dev`,
        displayName: 'Display Charlie Driver',
        role: 'PLAYER',
        isHelios: false,
      },
    ],
  });

  await prisma.event.create({
    data: {
      id: eventId,
      name: `Display Event ${token}`,
      startDate: new Date(now.getTime() - 60 * 60_000),
      endDate: new Date(now.getTime() + 60 * 60_000),
      status: 'ACTIVE',
      maxPlayers: 20,
      currentPlayerCount: 3,
      isPublic: true,
    },
  });

  await prisma.team.createMany({
    data: [
      {
        id: teamIds.alpha,
        eventId,
        name: `Display Alpha ${token}`,
        score: 1200,
        status: 'ACTIVE',
      },
      {
        id: teamIds.bravo,
        eventId,
        name: `Display Bravo ${token}`,
        score: 1900,
        status: 'IN_PIT',
        pitStopExpiresAt,
      },
      {
        id: teamIds.charlie,
        eventId,
        name: `Display Charlie ${token}`,
        score: 1400,
        status: 'PENDING',
      },
    ],
  });

  await prisma.player.createMany({
    data: [
      {
        id: `player-display-a-${token}`,
        userId: userIds[0],
        eventId,
        teamId: teamIds.alpha,
        status: 'RACING',
        joinedAt: now,
      },
      {
        id: `player-display-b-${token}`,
        userId: userIds[1],
        eventId,
        teamId: teamIds.alpha,
        status: 'RACING',
        joinedAt: now,
      },
      {
        id: `player-display-c-${token}`,
        userId: userIds[2],
        eventId,
        teamId: teamIds.bravo,
        status: 'IN_PIT',
        joinedAt: now,
      },
    ],
  });

  await prisma.teamStateTransition.createMany({
    data: [
      {
        id: `transition-hazard-${token}`,
        eventId,
        teamId: teamIds.bravo,
        fromStatus: 'ACTIVE',
        toStatus: 'IN_PIT',
        reason: 'HAZARD_TRIGGER',
        createdAt: transitionTimes.hazardTriggered,
      },
      {
        id: `transition-timer-${token}`,
        eventId,
        teamId: teamIds.bravo,
        fromStatus: 'IN_PIT',
        toStatus: 'ACTIVE',
        reason: 'TIMER_EXPIRED',
        createdAt: transitionTimes.timerExpired,
      },
      {
        id: `transition-admin-${token}`,
        eventId,
        teamId: teamIds.bravo,
        fromStatus: 'IN_PIT',
        toStatus: 'ACTIVE',
        reason: 'ADMIN_MANUAL',
        createdAt: transitionTimes.adminManual,
      },
      {
        id: `transition-rescue-${token}`,
        eventId,
        teamId: teamIds.bravo,
        fromStatus: 'IN_PIT',
        toStatus: 'ACTIVE',
        reason: 'RESCUE_CLEARED',
        createdAt: transitionTimes.rescueCleared,
      },
      {
        id: `transition-system-${token}`,
        eventId,
        teamId: teamIds.bravo,
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        reason: 'SYSTEM_RESET',
        createdAt: transitionTimes.systemReset,
      },
    ],
  });

  return {
    eventId,
    userIds,
    teamIds,
    pitStopExpiresAtIso: pitStopExpiresAt.toISOString(),
    transitionTimes: {
      hazardTriggered: transitionTimes.hazardTriggered.toISOString(),
      timerExpired: transitionTimes.timerExpired.toISOString(),
      adminManual: transitionTimes.adminManual.toISOString(),
      rescueCleared: transitionTimes.rescueCleared.toISOString(),
      systemReset: transitionTimes.systemReset.toISOString(),
    },
  };
}

async function cleanupDisplayFixture(fixture: DisplayFixture): Promise<void> {
  await prisma.teamStateTransition.deleteMany({
    where: {
      eventId: fixture.eventId,
    },
  });
  await prisma.player.deleteMany({
    where: {
      eventId: fixture.eventId,
    },
  });
  await prisma.team.deleteMany({
    where: {
      eventId: fixture.eventId,
    },
  });
  await prisma.eventConfig.deleteMany({
    where: {
      eventId: fixture.eventId,
    },
  });
  await prisma.hazardMultiplierRule.deleteMany({
    where: {
      eventId: fixture.eventId,
    },
  });
  await prisma.event.deleteMany({
    where: {
      id: fixture.eventId,
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [...fixture.userIds],
      },
    },
  });
}

describe('display endpoints', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;

  it('returns leaderboard rankings from database with pit-stop expiry metadata', async () => {
    const fixture = await createDisplayFixture();

    try {
      const response = await request(app).get(`${apiPrefix}/events/${fixture.eventId}/leaderboard`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject([
        {
          rank: 1,
          teamId: fixture.teamIds.bravo,
          score: 1900,
          status: 'IN_PIT',
          memberCount: 1,
          pitStopExpiresAt: fixture.pitStopExpiresAtIso,
        },
        {
          rank: 2,
          teamId: fixture.teamIds.charlie,
          score: 1400,
          status: 'PENDING',
          memberCount: 0,
          pitStopExpiresAt: null,
        },
        {
          rank: 3,
          teamId: fixture.teamIds.alpha,
          score: 1200,
          status: 'ACTIVE',
          memberCount: 2,
          pitStopExpiresAt: null,
        },
      ]);
    } finally {
      await cleanupDisplayFixture(fixture);
    }
  });

  it('filters display-events by cursor, keeps ordering, and maps transition reasons', async () => {
    const fixture = await createDisplayFixture();

    try {
      const allResponse = await request(app)
        .get(`${apiPrefix}/events/${fixture.eventId}/display-events`)
        .query({ limit: 10 });

      expect(allResponse.status).toBe(200);
      expect(allResponse.body.success).toBe(true);
      expect(allResponse.body.data.items).toHaveLength(4);
      expect(allResponse.body.data.items).toMatchObject([
        {
          reason: 'HAZARD_TRIGGER',
          type: 'TEAM_ENTERED_PIT',
          occurredAt: fixture.transitionTimes.hazardTriggered,
        },
        {
          reason: 'TIMER_EXPIRED',
          type: 'TEAM_EXITED_PIT',
          occurredAt: fixture.transitionTimes.timerExpired,
        },
        {
          reason: 'ADMIN_MANUAL',
          type: 'TEAM_EXITED_PIT',
          occurredAt: fixture.transitionTimes.adminManual,
        },
        {
          reason: 'RESCUE_CLEARED',
          type: 'TEAM_REPAIRS_COMPLETE',
          occurredAt: fixture.transitionTimes.rescueCleared,
        },
      ]);
      expect(allResponse.body.data.nextCursor).toBe(
        `${fixture.transitionTimes.rescueCleared}|${allResponse.body.data.items[3].id}`
      );

      const filteredResponse = await request(app)
        .get(`${apiPrefix}/events/${fixture.eventId}/display-events`)
        .query({ since: fixture.transitionTimes.timerExpired, limit: 10 });

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body.success).toBe(true);
      expect(filteredResponse.body.data.items).toMatchObject([
        {
          reason: 'ADMIN_MANUAL',
          type: 'TEAM_EXITED_PIT',
          occurredAt: fixture.transitionTimes.adminManual,
        },
        {
          reason: 'RESCUE_CLEARED',
          type: 'TEAM_REPAIRS_COMPLETE',
          occurredAt: fixture.transitionTimes.rescueCleared,
        },
      ]);
      expect(filteredResponse.body.data.items).toHaveLength(2);
      expect(filteredResponse.body.data.nextCursor).toBe(
        `${fixture.transitionTimes.rescueCleared}|${filteredResponse.body.data.items[1].id}`
      );
    } finally {
      await cleanupDisplayFixture(fixture);
    }
  });

  it('supports cursor pagination when multiple transitions share the same timestamp', async () => {
    const fixture = await createDisplayFixture();
    const sharedTimestamp = new Date(Date.UTC(2030, 3, 13, 2, 0, 6));

    await prisma.teamStateTransition.createMany({
      data: [
        {
          id: `transition-shared-a-${fixture.eventId}`,
          eventId: fixture.eventId,
          teamId: fixture.teamIds.alpha,
          fromStatus: 'ACTIVE',
          toStatus: 'IN_PIT',
          reason: 'HAZARD_TRIGGER',
          createdAt: sharedTimestamp,
        },
        {
          id: `transition-shared-b-${fixture.eventId}`,
          eventId: fixture.eventId,
          teamId: fixture.teamIds.bravo,
          fromStatus: 'IN_PIT',
          toStatus: 'ACTIVE',
          reason: 'TIMER_EXPIRED',
          createdAt: sharedTimestamp,
        },
      ],
    });

    try {
      const pageOne = await request(app)
        .get(`${apiPrefix}/events/${fixture.eventId}/display-events`)
        .query({ since: fixture.transitionTimes.rescueCleared, limit: 1 });

      expect(pageOne.status).toBe(200);
      expect(pageOne.body.success).toBe(true);
      expect(pageOne.body.data.items).toHaveLength(1);
      expect(pageOne.body.data.nextCursor).toBe(
        `${pageOne.body.data.items[0].occurredAt}|${pageOne.body.data.items[0].id}`
      );

      const pageTwo = await request(app)
        .get(`${apiPrefix}/events/${fixture.eventId}/display-events`)
        .query({ since: pageOne.body.data.nextCursor, limit: 10 });

      expect(pageTwo.status).toBe(200);
      expect(pageTwo.body.success).toBe(true);
      expect(pageTwo.body.data.items).toHaveLength(1);
      expect(pageTwo.body.data.items[0].occurredAt).toBe(sharedTimestamp.toISOString());
      expect(pageTwo.body.data.items[0].id).not.toBe(pageOne.body.data.items[0].id);
    } finally {
      await cleanupDisplayFixture(fixture);
    }
  });
});
