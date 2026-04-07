import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.js';
import { initiateRescue } from '../src/services/rescueService.js';
import { submitScan } from '../src/services/scanService.js';
import {
  setPitReleasePublisherForTests,
  type TeamPitReleasedEvent,
} from '../src/services/pitReleasePublisher.js';
import { releaseExpiredTeamsFromPit } from '../src/services/pitReleaseService.js';

interface ScanFixtureOptions {
  readonly globalHazardRatio?: number;
  readonly qrHazardOverride?: number | null;
  readonly qrHazardWeightOverride?: number | null;
  readonly initialGlobalScanCount?: number;
}

interface ScanFixture {
  readonly eventId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly qrCodeId: string;
  readonly qrPayload: string;
  readonly userIds: string[];
}

async function cleanupEventData(eventId: string, userIds: string[]): Promise<void> {
  await prisma.adminActionAudit.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.teamStateTransition.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.rescue.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.scanRecord.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.qRCodeClaim.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.player.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.qRCode.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.team.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.eventConfig.deleteMany({
    where: {
      eventId,
    },
  });
  await prisma.event.deleteMany({
    where: {
      id: eventId,
    },
  });

  if (userIds.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }
}

async function createScanFixture(options: ScanFixtureOptions = {}): Promise<ScanFixture> {
  const token = randomUUID().slice(0, 8);
  const eventId = `event-scan-${token}`;
  const teamId = `team-scan-${token}`;
  const playerId = `player-scan-${token}`;
  const userId = `user-scan-${token}`;
  const qrCodeId = `qr-scan-${token}`;
  const qrPayload = `VG-SCAN-${token.toUpperCase()}`;
  const now = new Date();

  await prisma.user.create({
    data: {
      id: userId,
      email: `scan-${token}@velocitygp.dev`,
      displayName: `Scan Player ${token}`,
      role: 'PLAYER',
      isHelios: false,
    },
  });

  await prisma.event.create({
    data: {
      id: eventId,
      name: `Scan Event ${token}`,
      description: 'Test event for scan enforcement.',
      startDate: new Date(now.getTime() - 60 * 60_000),
      endDate: new Date(now.getTime() + 60 * 60_000),
      status: 'ACTIVE',
      maxPlayers: 10,
      currentPlayerCount: 1,
      isPublic: false,
    },
  });

  await prisma.eventConfig.create({
    data: {
      eventId,
      globalHazardRatio: options.globalHazardRatio ?? 99,
      pitStopDurationSeconds: 900,
      invalidScanPenalty: 1,
      raceControlState: 'ACTIVE',
    },
  });

  await prisma.team.create({
    data: {
      id: teamId,
      eventId,
      name: `Scan Team ${token}`,
      score: 0,
      status: 'ACTIVE',
      pitStopExpiresAt: null,
    },
  });

  await prisma.player.create({
    data: {
      id: playerId,
      userId,
      eventId,
      teamId,
      status: 'RACING',
      individualScore: 0,
      isFlaggedForReview: false,
      joinedAt: now,
    },
  });

  await prisma.qRCode.create({
    data: {
      id: qrCodeId,
      eventId,
      label: `Scan QR ${token}`,
      value: 100,
      zone: 'Test Zone',
      payload: qrPayload,
      status: 'ACTIVE',
      activationStartsAt: new Date(now.getTime() - 5 * 60_000),
      activationEndsAt: null,
      hazardRatioOverride: options.qrHazardOverride ?? null,
      hazardWeightOverride: options.qrHazardWeightOverride ?? null,
      scanCount: 0,
    },
  });

  const initialScanCount = options.initialGlobalScanCount ?? 0;
  if (initialScanCount > 0) {
    await prisma.scanRecord.createMany({
      data: Array.from({ length: initialScanCount }, (_unused, index) => ({
        id: `scan-seed-${token}-${index}`,
        eventId,
        qrCodeId: null,
        playerId,
        teamId,
        outcome: 'INVALID',
        pointsAwarded: -1,
        hazardRatioUsed: null,
        globalScanCountBefore: index,
        globalScanCountAfter: index + 1,
        scannedPayload: `VG-SEED-${index}`,
        message: 'Seeded scan record',
        createdAt: new Date(now.getTime() - (index + 1) * 60_000),
      })),
    });
  }

  return {
    eventId,
    teamId,
    playerId,
    qrCodeId,
    qrPayload,
    userIds: [userId],
  };
}

describe('system backend enforcement', () => {
  it('persists claims and increments score for safe scans', async () => {
    const fixture = await createScanFixture();

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: fixture.qrPayload,
        },
      });

      expect(response.outcome).toBe('SAFE');
      if (response.outcome !== 'SAFE') {
        throw new Error(`Expected SAFE outcome but received ${response.outcome}.`);
      }
      expect(response.hazardRatioUsed).toBe(99);
      expect(response.claimCreated).toBe(true);

      const [team, claim, safeScans] = await Promise.all([
        prisma.team.findUnique({
          where: {
            id: fixture.teamId,
          },
          select: {
            score: true,
          },
        }),
        prisma.qRCodeClaim.findFirst({
          where: {
            eventId: fixture.eventId,
            qrCodeId: fixture.qrCodeId,
            playerId: fixture.playerId,
          },
        }),
        prisma.scanRecord.count({
          where: {
            eventId: fixture.eventId,
            outcome: 'SAFE',
          },
        }),
      ]);

      expect(team?.score).toBe(100);
      expect(claim).not.toBeNull();
      expect(safeScans).toBe(1);
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('prevents double-apply under concurrent duplicate scans', async () => {
    const fixture = await createScanFixture();

    try {
      const [first, second] = await Promise.all([
        submitScan({
          eventId: fixture.eventId,
          request: {
            playerId: fixture.playerId,
            qrPayload: fixture.qrPayload,
          },
        }),
        submitScan({
          eventId: fixture.eventId,
          request: {
            playerId: fixture.playerId,
            qrPayload: fixture.qrPayload,
          },
        }),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(['DUPLICATE', 'SAFE']);

      const claimCount = await prisma.qRCodeClaim.count({
        where: {
          eventId: fixture.eventId,
          qrCodeId: fixture.qrCodeId,
          playerId: fixture.playerId,
        },
      });

      expect(claimCount).toBe(1);
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('uses per-QR hazard override precedence and triggers pit transition on modulo', async () => {
    const fixture = await createScanFixture({
      globalHazardRatio: 50,
      qrHazardOverride: 2,
      initialGlobalScanCount: 1,
    });

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: fixture.qrPayload,
        },
      });

      expect(response.outcome).toBe('HAZARD_PIT');
      if (response.outcome !== 'HAZARD_PIT') {
        throw new Error(`Expected HAZARD_PIT outcome but received ${response.outcome}.`);
      }
      expect(response.hazardRatioUsed).toBe(2);

      const [team, transition] = await Promise.all([
        prisma.team.findUnique({
          where: {
            id: fixture.teamId,
          },
          select: {
            status: true,
            pitStopExpiresAt: true,
          },
        }),
        prisma.teamStateTransition.findFirst({
          where: {
            eventId: fixture.eventId,
            teamId: fixture.teamId,
            reason: 'HAZARD_TRIGGER',
          },
        }),
      ]);

      expect(team?.status).toBe('IN_PIT');
      expect(team?.pitStopExpiresAt).not.toBeNull();
      expect(transition).not.toBeNull();
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('uses per-QR hazard weight override of 100 to force hazard outcomes', async () => {
    const fixture = await createScanFixture({
      globalHazardRatio: 999,
      qrHazardWeightOverride: 100,
      initialGlobalScanCount: 0,
    });

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: fixture.qrPayload,
        },
      });

      expect(response.outcome).toBe('HAZARD_PIT');
      if (response.outcome !== 'HAZARD_PIT') {
        throw new Error(`Expected HAZARD_PIT outcome but received ${response.outcome}.`);
      }

      const team = await prisma.team.findUnique({
        where: {
          id: fixture.teamId,
        },
        select: {
          status: true,
        },
      });

      expect(team?.status).toBe('IN_PIT');
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('uses per-QR hazard weight override of 0 to bypass ratio-triggered hazards', async () => {
    const fixture = await createScanFixture({
      globalHazardRatio: 2,
      qrHazardOverride: 2,
      qrHazardWeightOverride: 0,
      initialGlobalScanCount: 1,
    });

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: fixture.qrPayload,
        },
      });

      expect(response.outcome).toBe('SAFE');
      if (response.outcome !== 'SAFE') {
        throw new Error(`Expected SAFE outcome but received ${response.outcome}.`);
      }

      const team = await prisma.team.findUnique({
        where: {
          id: fixture.teamId,
        },
        select: {
          status: true,
        },
      });

      expect(team?.status).toBe('ACTIVE');
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('rejects same-team rescue attempts with SELF_RESCUE_FORBIDDEN and records rejection', async () => {
    const token = randomUUID().slice(0, 8);
    const eventId = `event-rescue-${token}`;
    const teamId = `team-rescue-${token}`;
    const scannerUserId = `user-scanner-${token}`;
    const scannerPlayerId = `player-scanner-${token}`;
    const scanneeUserId = `user-scannee-${token}`;
    const scanneePlayerId = `player-scannee-${token}`;

    await prisma.user.createMany({
      data: [
        {
          id: scannerUserId,
          email: `scanner-${token}@velocitygp.dev`,
          displayName: 'Scanner',
          role: 'PLAYER',
          isHelios: false,
        },
        {
          id: scanneeUserId,
          email: `scannee-${token}@velocitygp.dev`,
          displayName: 'Scannee',
          role: 'PLAYER',
          isHelios: false,
        },
      ],
    });

    const now = new Date();
    await prisma.event.create({
      data: {
        id: eventId,
        name: `Rescue Event ${token}`,
        startDate: new Date(now.getTime() - 60 * 60_000),
        endDate: new Date(now.getTime() + 60 * 60_000),
        status: 'ACTIVE',
        isPublic: false,
      },
    });

    await prisma.eventConfig.create({
      data: {
        eventId,
        globalHazardRatio: 15,
        pitStopDurationSeconds: 900,
        invalidScanPenalty: 1,
        raceControlState: 'ACTIVE',
      },
    });

    await prisma.team.create({
      data: {
        id: teamId,
        eventId,
        name: `Rescue Team ${token}`,
        score: 0,
        status: 'IN_PIT',
        pitStopExpiresAt: new Date(now.getTime() + 15 * 60_000),
      },
    });

    await prisma.player.createMany({
      data: [
        {
          id: scannerPlayerId,
          userId: scannerUserId,
          eventId,
          teamId,
          status: 'RACING',
          individualScore: 0,
          joinedAt: now,
        },
        {
          id: scanneePlayerId,
          userId: scanneeUserId,
          eventId,
          teamId,
          status: 'IN_PIT',
          individualScore: 0,
          joinedAt: now,
        },
      ],
    });

    try {
      await expect(
        initiateRescue({
          playerId: scanneePlayerId,
          eventId,
          scannerUserId,
        })
      ).rejects.toMatchObject({
        code: 'SELF_RESCUE_FORBIDDEN',
      });

      const rejected = await prisma.rescue.findFirst({
        where: {
          eventId,
          requestingPlayerId: scanneePlayerId,
          status: 'REJECTED',
        },
      });

      expect(rejected?.reason).toBe('SELF_RESCUE_FORBIDDEN');
    } finally {
      await cleanupEventData(eventId, [scannerUserId, scanneeUserId]);
    }
  });

  it('auto-releases expired pit teams and publishes unlock events once', async () => {
    const token = randomUUID().slice(0, 8);
    const eventId = `event-pit-${token}`;
    const teamId = `team-pit-${token}`;
    const userId = `user-pit-${token}`;
    const playerId = `player-pit-${token}`;
    const now = new Date();
    const publishedEvents: TeamPitReleasedEvent[] = [];

    await prisma.user.create({
      data: {
        id: userId,
        email: `pit-${token}@velocitygp.dev`,
        displayName: 'Pit Racer',
        role: 'PLAYER',
        isHelios: false,
      },
    });

    await prisma.event.create({
      data: {
        id: eventId,
        name: `Pit Event ${token}`,
        startDate: new Date(now.getTime() - 60 * 60_000),
        endDate: new Date(now.getTime() + 60 * 60_000),
        status: 'ACTIVE',
        isPublic: false,
      },
    });

    await prisma.eventConfig.create({
      data: {
        eventId,
        globalHazardRatio: 15,
        pitStopDurationSeconds: 900,
        invalidScanPenalty: 1,
        raceControlState: 'ACTIVE',
      },
    });

    await prisma.team.create({
      data: {
        id: teamId,
        eventId,
        name: `Pit Team ${token}`,
        score: 0,
        status: 'IN_PIT',
        pitStopExpiresAt: new Date(now.getTime() - 60_000),
      },
    });

    await prisma.player.create({
      data: {
        id: playerId,
        userId,
        eventId,
        teamId,
        status: 'IN_PIT',
        individualScore: 0,
        joinedAt: now,
      },
    });

    setPitReleasePublisherForTests({
      publishTeamReleased: async (event) => {
        publishedEvents.push(event);
      },
    });

    try {
      const result = await releaseExpiredTeamsFromPit({
        now,
        batchSize: 10,
      });

      expect(result.released).toBe(1);
      expect(result.publishFailures).toBe(0);

      const [team, transition] = await Promise.all([
        prisma.team.findUnique({
          where: {
            id: teamId,
          },
          select: {
            status: true,
            pitStopExpiresAt: true,
          },
        }),
        prisma.teamStateTransition.findFirst({
          where: {
            eventId,
            teamId,
            reason: 'TIMER_EXPIRED',
          },
        }),
      ]);

      expect(team?.status).toBe('ACTIVE');
      expect(team?.pitStopExpiresAt).toBeNull();
      expect(transition).not.toBeNull();
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0]?.teamId).toBe(teamId);
    } finally {
      setPitReleasePublisherForTests(null);
      await cleanupEventData(eventId, [userId]);
    }
  });
});
