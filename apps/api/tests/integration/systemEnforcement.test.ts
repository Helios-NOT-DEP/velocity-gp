import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/client.js';
import { initiateRescue } from '../../src/services/rescueService.js';
import { submitScan } from '../../src/services/scanService.js';
import {
  setPitReleasePublisherForTests,
  type TeamPitReleasedEvent,
} from '../../src/services/pitReleasePublisher.js';
import { releaseExpiredTeamsFromPit } from '../../src/services/pitReleaseService.js';

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
  await prisma.teamActivityEvent.deleteMany({
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
  await prisma.hazardMultiplierRule.deleteMany({
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

  it('blocks scans for teams in active pit lockout and returns authoritative pit expiry', async () => {
    const fixture = await createScanFixture();
    const now = new Date();
    const pitStopExpiresAt = new Date(now.getTime() + 5 * 60_000);

    await prisma.team.update({
      where: {
        id: fixture.teamId,
      },
      data: {
        status: 'IN_PIT',
        pitStopExpiresAt,
      },
    });

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: fixture.qrPayload,
        },
      });

      expect(response.outcome).toBe('BLOCKED');
      if (response.outcome !== 'BLOCKED') {
        throw new Error(`Expected BLOCKED outcome but received ${response.outcome}.`);
      }
      expect(response.errorCode).toBe('TEAM_IN_PIT');
      if (response.errorCode !== 'TEAM_IN_PIT') {
        throw new Error(`Expected TEAM_IN_PIT errorCode but received ${response.errorCode}.`);
      }
      expect(response.pitStopExpiresAt).toBe(pitStopExpiresAt.toISOString());
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('does not apply invalid scan penalties while a team is in active pit lockout', async () => {
    const fixture = await createScanFixture();
    const now = new Date();
    const pitStopExpiresAt = new Date(now.getTime() + 5 * 60_000);
    const unknownPayload = `VG-UNKNOWN-${randomUUID().slice(0, 8).toUpperCase()}`;

    await prisma.team.update({
      where: {
        id: fixture.teamId,
      },
      data: {
        status: 'IN_PIT',
        pitStopExpiresAt,
      },
    });

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: unknownPayload,
        },
      });

      expect(response.outcome).toBe('BLOCKED');
      if (response.outcome !== 'BLOCKED') {
        throw new Error(`Expected BLOCKED outcome but received ${response.outcome}.`);
      }
      expect(response.errorCode).toBe('TEAM_IN_PIT');
      if (response.errorCode !== 'TEAM_IN_PIT') {
        throw new Error(`Expected TEAM_IN_PIT errorCode but received ${response.errorCode}.`);
      }
      expect(response.pitStopExpiresAt).toBe(pitStopExpiresAt.toISOString());

      const [team, player, invalidScanCount] = await Promise.all([
        prisma.team.findUnique({
          where: {
            id: fixture.teamId,
          },
          select: {
            score: true,
          },
        }),
        prisma.player.findUnique({
          where: {
            id: fixture.playerId,
          },
          select: {
            isFlaggedForReview: true,
          },
        }),
        prisma.scanRecord.count({
          where: {
            eventId: fixture.eventId,
            outcome: 'INVALID',
          },
        }),
      ]);

      expect(team?.score).toBe(0);
      expect(player?.isFlaggedForReview).toBe(false);
      expect(invalidScanCount).toBe(0);
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('applies invalid scan penalty and flags player for review during active racing', async () => {
    const fixture = await createScanFixture();
    const unknownPayload = `VG-UNKNOWN-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      const response = await submitScan({
        eventId: fixture.eventId,
        request: {
          playerId: fixture.playerId,
          qrPayload: unknownPayload,
        },
      });

      expect(response.outcome).toBe('INVALID');
      if (response.outcome !== 'INVALID') {
        throw new Error(`Expected INVALID outcome but received ${response.outcome}.`);
      }
      expect(response.errorCode).toBe('QR_NOT_FOUND');
      expect(response.pointsAwarded).toBe(-1);
      expect(response.flaggedForReview).toBe(true);

      const [team, player, invalidScan] = await Promise.all([
        prisma.team.findUnique({
          where: {
            id: fixture.teamId,
          },
          select: {
            score: true,
          },
        }),
        prisma.player.findUnique({
          where: {
            id: fixture.playerId,
          },
          select: {
            isFlaggedForReview: true,
          },
        }),
        prisma.scanRecord.findFirst({
          where: {
            eventId: fixture.eventId,
            playerId: fixture.playerId,
            outcome: 'INVALID',
          },
          select: {
            pointsAwarded: true,
            scannedPayload: true,
          },
        }),
      ]);

      expect(team?.score).toBe(-1);
      expect(player?.isFlaggedForReview).toBe(true);
      expect(invalidScan?.pointsAwarded).toBe(-1);
      expect(invalidScan?.scannedPayload).toBe(unknownPayload);
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

  it('applies active scheduled hazard multipliers to the effective hazard ratio', async () => {
    const fixture = await createScanFixture({
      globalHazardRatio: 4,
      qrHazardOverride: null,
      initialGlobalScanCount: 1,
    });

    try {
      const now = new Date();
      await prisma.hazardMultiplierRule.create({
        data: {
          eventId: fixture.eventId,
          name: 'Peak Window',
          startsAt: new Date(now.getTime() - 60_000),
          endsAt: new Date(now.getTime() + 60_000),
          ratioMultiplier: 0.5,
        },
      });

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
    } finally {
      await cleanupEventData(fixture.eventId, fixture.userIds);
    }
  });

  it('ignores scheduled multipliers outside their configured time window', async () => {
    const fixture = await createScanFixture({
      globalHazardRatio: 4,
      qrHazardOverride: null,
      initialGlobalScanCount: 1,
    });

    try {
      const now = new Date();
      await prisma.hazardMultiplierRule.create({
        data: {
          eventId: fixture.eventId,
          name: 'Expired Rule',
          startsAt: new Date(now.getTime() - 10 * 60_000),
          endsAt: new Date(now.getTime() - 5 * 60_000),
          ratioMultiplier: 0.5,
        },
      });

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
      expect(response.hazardRatioUsed).toBe(4);
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

      expect(result.released).toBeGreaterThanOrEqual(1);
      expect(result.publishFailures).toBeGreaterThanOrEqual(0);

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

      const releasedEventForFixture = publishedEvents.find(
        (event) => event.eventId === eventId && event.teamId === teamId
      );
      expect(releasedEventForFixture).toBeDefined();
    } finally {
      setPitReleasePublisherForTests(null);
      await cleanupEventData(eventId, [userId]);
    }
  });
});
