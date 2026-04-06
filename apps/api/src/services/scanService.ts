import type {
  ScanHazardRequest,
  StableErrorCode,
  SubmitScanRequest,
  SubmitScanResponse,
} from '@velocity-gp/api-contract';

import { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { logger } from '../lib/logger.js';
import { ValidationError } from '../utils/appError.js';

interface SubmitScanInput {
  readonly eventId: string;
  readonly request: SubmitScanRequest;
}

const SERIALIZATION_RETRY_LIMIT = 3;

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function isSerializationFailure(error: unknown): boolean {
  return isKnownPrismaError(error) && error.code === 'P2034';
}

function resolveHazardRatio(hazardRatioOverride: number | null, globalHazardRatio: number): number {
  const configuredRatio = hazardRatioOverride ?? globalHazardRatio;
  return configuredRatio > 0 ? configuredRatio : 1;
}

async function processScanInTransaction(
  tx: Prisma.TransactionClient,
  input: SubmitScanInput,
  qrPayload: string,
  now: Date
): Promise<SubmitScanResponse> {
  const [eventConfig, playerWithTeam, globalScanCountBefore] = await Promise.all([
    tx.eventConfig.findUnique({
      where: {
        eventId: input.eventId,
      },
      select: {
        eventId: true,
        globalHazardRatio: true,
        invalidScanPenalty: true,
        pitStopDurationSeconds: true,
        raceControlState: true,
      },
    }),
    tx.player.findFirst({
      where: {
        id: input.request.playerId,
        eventId: input.eventId,
      },
      include: {
        team: {
          select: {
            id: true,
            score: true,
            status: true,
            pitStopExpiresAt: true,
          },
        },
      },
    }),
    tx.scanRecord.count({
      where: {
        eventId: input.eventId,
      },
    }),
  ]);

  if (!eventConfig) {
    throw new ValidationError('Event configuration is missing for scan processing.', {
      eventId: input.eventId,
    });
  }

  if (!playerWithTeam) {
    throw new ValidationError('Player does not exist for this event.', {
      eventId: input.eventId,
      playerId: input.request.playerId,
    });
  }

  if (!playerWithTeam.team) {
    throw new ValidationError('Player must be assigned to a team before scanning.', {
      eventId: input.eventId,
      playerId: input.request.playerId,
    });
  }

  const team = playerWithTeam.team;
  const globalScanCountAfter = globalScanCountBefore + 1;

  const qrCode = await tx.qRCode.findFirst({
    where: {
      eventId: input.eventId,
      payload: qrPayload,
    },
    select: {
      id: true,
      status: true,
      value: true,
      hazardRatioOverride: true,
    },
  });

  if (!qrCode) {
    const pointsAwarded = -Math.abs(eventConfig.invalidScanPenalty);
    const message = 'QR payload is not recognized.';

    const scanRecord = await tx.scanRecord.create({
      data: {
        eventId: input.eventId,
        playerId: playerWithTeam.id,
        teamId: team.id,
        qrCodeId: null,
        outcome: 'INVALID',
        pointsAwarded,
        hazardRatioUsed: null,
        globalScanCountBefore,
        globalScanCountAfter,
        scannedPayload: qrPayload,
        message,
      },
      select: {
        createdAt: true,
      },
    });

    await tx.player.update({
      where: {
        id: playerWithTeam.id,
      },
      data: {
        isFlaggedForReview: true,
      },
    });

    return {
      outcome: 'INVALID',
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: null,
      qrPayload,
      scannedAt: scanRecord.createdAt.toISOString(),
      message,
      pointsAwarded,
      errorCode: 'QR_NOT_FOUND',
      flaggedForReview: true,
    };
  }

  const blockedTeamInPit =
    team.status === 'IN_PIT' && (!team.pitStopExpiresAt || team.pitStopExpiresAt.getTime() > now.getTime());

  if (eventConfig.raceControlState === 'PAUSED') {
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrPayload,
      message: 'Race control is paused.',
      errorCode: 'RACE_PAUSED',
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  if (blockedTeamInPit) {
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrPayload,
      message: 'Team is currently in pit stop lockout.',
      errorCode: 'TEAM_IN_PIT',
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  if (qrCode.status === 'DISABLED') {
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrPayload,
      message: 'QR code is disabled by admin control.',
      errorCode: 'QR_DISABLED',
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  const hazardRatioUsed = resolveHazardRatio(
    qrCode.hazardRatioOverride,
    eventConfig.globalHazardRatio
  );

  const claimResult = await tx.qRCodeClaim.createMany({
    data: [
      {
        eventId: input.eventId,
        qrCodeId: qrCode.id,
        playerId: playerWithTeam.id,
      },
    ],
    skipDuplicates: true,
  });

  if (claimResult.count === 0) {
    const message = 'Player has already claimed this QR code.';
    const scanRecord = await tx.scanRecord.create({
      data: {
        eventId: input.eventId,
        playerId: playerWithTeam.id,
        teamId: team.id,
        qrCodeId: qrCode.id,
        outcome: 'DUPLICATE',
        pointsAwarded: 0,
        hazardRatioUsed,
        globalScanCountBefore,
        globalScanCountAfter,
        scannedPayload: qrPayload,
        message,
      },
      select: {
        createdAt: true,
      },
    });

    return {
      outcome: 'DUPLICATE',
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrPayload,
      scannedAt: scanRecord.createdAt.toISOString(),
      message,
      pointsAwarded: 0,
      errorCode: 'ALREADY_CLAIMED',
    };
  }

  await tx.qRCode.update({
    where: {
      id: qrCode.id,
    },
    data: {
      scanCount: {
        increment: 1,
      },
    },
  });

  const hazardTriggered = globalScanCountAfter % hazardRatioUsed === 0;
  if (hazardTriggered) {
    const pitStopExpiresAt = new Date(now.getTime() + eventConfig.pitStopDurationSeconds * 1_000);

    const [updatedTeam, scanRecord] = await Promise.all([
      tx.team.update({
        where: {
          id: team.id,
        },
        data: {
          status: 'IN_PIT',
          pitStopExpiresAt,
        },
        select: {
          score: true,
        },
      }),
      tx.scanRecord.create({
        data: {
          eventId: input.eventId,
          playerId: playerWithTeam.id,
          teamId: team.id,
          qrCodeId: qrCode.id,
          outcome: 'HAZARD_PIT',
          pointsAwarded: 0,
          hazardRatioUsed,
          globalScanCountBefore,
          globalScanCountAfter,
          scannedPayload: qrPayload,
          message: 'Hazard trigger reached. Team moved to pit stop.',
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    await Promise.all([
      tx.player.updateMany({
        where: {
          teamId: team.id,
        },
        data: {
          status: 'IN_PIT',
        },
      }),
      tx.teamStateTransition.create({
        data: {
          eventId: input.eventId,
          teamId: team.id,
          fromStatus: team.status,
          toStatus: 'IN_PIT',
          reason: 'HAZARD_TRIGGER',
          triggeredByPlayerId: playerWithTeam.id,
          notes: `Hazard modulo triggered at global scan #${globalScanCountAfter}.`,
        },
      }),
    ]);

    return {
      outcome: 'HAZARD_PIT',
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrPayload,
      scannedAt: scanRecord.createdAt.toISOString(),
      message: 'Hazard trigger reached. Team moved to pit stop.',
      pointsAwarded: 0,
      teamScore: updatedTeam.score,
      pitStopExpiresAt: pitStopExpiresAt.toISOString(),
      hazardRatioUsed,
    };
  }

  const [updatedTeam, scanRecord] = await Promise.all([
    tx.team.update({
      where: {
        id: team.id,
      },
      data: {
        score: {
          increment: qrCode.value,
        },
      },
      select: {
        score: true,
      },
    }),
    tx.scanRecord.create({
      data: {
        eventId: input.eventId,
        playerId: playerWithTeam.id,
        teamId: team.id,
        qrCodeId: qrCode.id,
        outcome: 'SAFE',
        pointsAwarded: qrCode.value,
        hazardRatioUsed,
        globalScanCountBefore,
        globalScanCountAfter,
        scannedPayload: qrPayload,
        message: 'Safe scan awarded points.',
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  await tx.player.update({
    where: {
      id: playerWithTeam.id,
    },
    data: {
      individualScore: {
        increment: qrCode.value,
      },
      status: 'RACING',
    },
  });

  return {
    outcome: 'SAFE',
    eventId: input.eventId,
    playerId: playerWithTeam.id,
    teamId: team.id,
    qrCodeId: qrCode.id,
    qrPayload,
    scannedAt: scanRecord.createdAt.toISOString(),
    message: 'Safe scan awarded points.',
    pointsAwarded: qrCode.value,
    teamScore: updatedTeam.score,
    claimCreated: true,
    hazardRatioUsed,
  };
}

interface CreateBlockedScanResponseInput {
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly qrCodeId: string;
  readonly qrPayload: string;
  readonly message: string;
  readonly errorCode: Extract<StableErrorCode, 'QR_DISABLED' | 'RACE_PAUSED' | 'TEAM_IN_PIT'>;
  readonly globalScanCountBefore: number;
  readonly globalScanCountAfter: number;
}

async function createBlockedScanResponse(
  tx: Prisma.TransactionClient,
  input: CreateBlockedScanResponseInput
): Promise<SubmitScanResponse> {
  const scanRecord = await tx.scanRecord.create({
    data: {
      eventId: input.eventId,
      playerId: input.playerId,
      teamId: input.teamId,
      qrCodeId: input.qrCodeId,
      outcome: 'BLOCKED',
      pointsAwarded: 0,
      hazardRatioUsed: null,
      globalScanCountBefore: input.globalScanCountBefore,
      globalScanCountAfter: input.globalScanCountAfter,
      scannedPayload: input.qrPayload,
      message: input.message,
    },
    select: {
      createdAt: true,
    },
  });

  return {
    outcome: 'BLOCKED',
    eventId: input.eventId,
    playerId: input.playerId,
    teamId: input.teamId,
    qrCodeId: input.qrCodeId,
    qrPayload: input.qrPayload,
    scannedAt: scanRecord.createdAt.toISOString(),
    message: input.message,
    pointsAwarded: 0,
    errorCode: input.errorCode,
  };
}

export async function submitScan(input: SubmitScanInput): Promise<SubmitScanResponse> {
  const qrPayload = input.request.qrPayload.trim();
  if (!qrPayload) {
    throw new ValidationError('QR payload cannot be empty.', {
      eventId: input.eventId,
      playerId: input.request.playerId,
    });
  }

  return withTraceSpan('scan.submit', { eventId: input.eventId, playerId: input.request.playerId }, async () => {
    let attempt = 0;
    while (attempt < SERIALIZATION_RETRY_LIMIT) {
      try {
        const result = await prisma.$transaction(
          (tx) => processScanInTransaction(tx, input, qrPayload, new Date()),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }
        );
        incrementCounter('scan.outcome.total', { outcome: result.outcome });
        return result;
      } catch (error) {
        if (!isSerializationFailure(error) || attempt === SERIALIZATION_RETRY_LIMIT - 1) {
          throw error;
        }

        attempt += 1;
        logger.warn(
          {
            eventId: input.eventId,
            playerId: input.request.playerId,
            attempt,
          },
          'serialization conflict during scan processing, retrying'
        );
      }
    }

    throw new ValidationError('Scan processing failed after retries.', {
      eventId: input.eventId,
      playerId: input.request.playerId,
    });
  });
}

export async function submitLegacyScan(request: ScanHazardRequest): Promise<SubmitScanResponse> {
  return submitScan({
    eventId: request.eventId,
    request: {
      playerId: request.playerId,
      qrPayload: request.qrCode,
    },
  });
}
