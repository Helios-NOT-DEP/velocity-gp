import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/createApp.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/client.js';

describe('garage authorization checks', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;
  const token = randomUUID().slice(0, 8);

  const ids = {
    eventId: `event-garage-auth-${token}`,
    userAId: `user-garage-auth-a-${token}`,
    userBId: `user-garage-auth-b-${token}`,
    teamAId: `team-garage-auth-a-${token}`,
    teamBId: `team-garage-auth-b-${token}`,
    playerAId: `player-garage-auth-a-${token}`,
    playerBId: `player-garage-auth-b-${token}`,
  };

  beforeAll(async () => {
    const now = new Date();

    await prisma.user.createMany({
      data: [
        {
          id: ids.userAId,
          email: `garage-auth-a-${token}@velocitygp.dev`,
          displayName: 'Garage Auth A',
          role: 'PLAYER',
          isHelios: false,
        },
        {
          id: ids.userBId,
          email: `garage-auth-b-${token}@velocitygp.dev`,
          displayName: 'Garage Auth B',
          role: 'PLAYER',
          isHelios: false,
        },
      ],
    });

    await prisma.event.create({
      data: {
        id: ids.eventId,
        name: `Garage Authorization Event ${token}`,
        startDate: new Date(now.getTime() - 60 * 60_000),
        endDate: new Date(now.getTime() + 60 * 60_000),
        status: 'ACTIVE',
        maxPlayers: 10,
        currentPlayerCount: 2,
        isPublic: false,
      },
    });

    await prisma.team.createMany({
      data: [
        {
          id: ids.teamAId,
          eventId: ids.eventId,
          name: `Garage Auth Team A ${token}`,
          status: 'ACTIVE',
          requiredPlayerCount: 2,
        },
        {
          id: ids.teamBId,
          eventId: ids.eventId,
          name: `Garage Auth Team B ${token}`,
          status: 'ACTIVE',
          requiredPlayerCount: 2,
        },
      ],
    });

    await prisma.player.createMany({
      data: [
        {
          id: ids.playerAId,
          userId: ids.userAId,
          eventId: ids.eventId,
          teamId: ids.teamAId,
          status: 'RACING',
          joinedAt: now,
        },
        {
          id: ids.playerBId,
          userId: ids.userBId,
          eventId: ids.eventId,
          teamId: ids.teamBId,
          status: 'RACING',
          joinedAt: now,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.garageSubmission.deleteMany({
      where: {
        teamId: {
          in: [ids.teamAId, ids.teamBId],
        },
      },
    });
    await prisma.player.deleteMany({
      where: {
        id: {
          in: [ids.playerAId, ids.playerBId],
        },
      },
    });
    await prisma.team.deleteMany({
      where: {
        id: {
          in: [ids.teamAId, ids.teamBId],
        },
      },
    });
    await prisma.event.deleteMany({
      where: {
        id: ids.eventId,
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ids.userAId, ids.userBId],
        },
      },
    });
  });

  it('rejects submit when player is not assigned to the requested team', async () => {
    const response = await request(app).post(`${apiPrefix}/garage/submit`).send({
      playerId: ids.playerAId,
      teamId: ids.teamBId,
      eventId: ids.eventId,
      description: 'Focused, resilient, and strategic under pressure.',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects team status polling when player is not assigned to the team', async () => {
    const response = await request(app).get(
      `${apiPrefix}/garage/team/${ids.teamBId}/status?playerId=${ids.playerAId}`
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
