import { randomInt } from 'node:crypto';

import type {
  ScanHazardRequest,
  StableErrorCode,
  SubmitScanRequest,
  SubmitScanResponse,
} from '@velocity-gp/api-contract';

import { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { runWithSerializationRetry } from '../db/retry.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { ValidationError } from '../utils/appError.js';
import {
  buildScanActivitySummary,
  recordScanActivityInTransaction,
} from './teamActivityFeedService.js';

/**
 * QR scan processing service.
 *
 * This service is transaction-heavy and responsible for:
 * - validating event/player/team/QR state
 * - creating scan records for all outcomes
 * - awarding points or applying pit-stop hazards
 * - retrying serialization conflicts for high-concurrency scans
 */
interface SubmitScanInput {
  readonly eventId: string;
  readonly request: SubmitScanRequest;
}

/**
 * Resolves effective hazard ratio with per-QR override precedence.
 */
function resolveHazardRatio(hazardRatioOverride: number | null, globalHazardRatio: number): number {
  const configuredRatio = hazardRatioOverride ?? globalHazardRatio;
  return configuredRatio > 0 ? configuredRatio : 1;
}

function applyHazardMultiplier(baseRatio: number, ratioMultiplier: number | null): number {
  if (ratioMultiplier === null) {
    return baseRatio;
  }

  const multiplied = Math.round(baseRatio * ratioMultiplier);
  return multiplied > 0 ? multiplied : 1;
}

interface ResolveHazardDecisionInput {
  readonly globalScanCountAfter: number;
  readonly hazardRatioUsed: number;
  readonly hazardWeightOverride: number | null;
}

/**
 * Resolves whether a scan triggers pit hazard.
 *
 * If `hazardWeightOverride` is set, it acts as percent chance (0..100).
 * Otherwise, hazard triggers by modulo using global scan count.
 */
function resolveHazardDecision(input: ResolveHazardDecisionInput): boolean {
  if (input.hazardWeightOverride !== null) {
    if (input.hazardWeightOverride <= 0) {
      return false;
    }

    if (input.hazardWeightOverride >= 100) {
      return true;
    }

    return randomInt(100) < input.hazardWeightOverride;
  }

  return input.globalScanCountAfter % input.hazardRatioUsed === 0;
}

/**
 * Executes complete scan processing inside a transaction.
 */
async function processScanInTransaction(
  tx: Prisma.TransactionClient,
  input: SubmitScanInput,
  qrPayload: string,
  now: Date
): Promise<SubmitScanResponse> {
  // Load all state that influences scan outcome before mutating any records.
  const [eventConfig, playerWithTeam, globalScanCountBefore, activeMultiplierRule] =
    await Promise.all([
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
      tx.hazardMultiplierRule.findFirst({
        where: {
          eventId: input.eventId,
          deletedAt: null,
          startsAt: {
            lte: now,
          },
          endsAt: {
            gt: now,
          },
        },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          ratioMultiplier: true,
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

  if (eventConfig.raceControlState === 'PAUSED') {
    // Race-control pause short-circuits all scans but still records blocked attempts.
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: null,
      qrCodeLabel: null,
      qrPayload,
      message: 'Race control is paused.',
      errorCode: 'RACE_PAUSED',
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  const blockedTeamInPit =
    team.status === 'IN_PIT' &&
    (!team.pitStopExpiresAt || team.pitStopExpiresAt.getTime() > now.getTime());

  if (blockedTeamInPit) {
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: null,
      qrCodeLabel: null,
      qrPayload,
      message: 'Team is currently in pit stop lockout.',
      errorCode: 'TEAM_IN_PIT',
      pitStopExpiresAt: team.pitStopExpiresAt?.toISOString() ?? null,
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  const qrCode = await tx.qRCode.findFirst({
    where: {
      eventId: input.eventId,
      payload: qrPayload,
      deletedAt: null,
      AND: [
        {
          OR: [{ activationStartsAt: null }, { activationStartsAt: { lte: now } }],
        },
        {
          OR: [{ activationEndsAt: null }, { activationEndsAt: { gt: now } }],
        },
      ],
    },
    select: {
      id: true,
      label: true,
      status: true,
      value: true,
      hazardRatioOverride: true,
      hazardWeightOverride: true,
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
        id: true,
        createdAt: true,
      },
    });

    // Apply the penalty to the team's live score so the leaderboard reflects it.
    const updatedTeam = await tx.team.update({
      where: { id: team.id },
      data: { score: { decrement: Math.abs(eventConfig.invalidScanPenalty) } },
      select: { score: true },
    });

    await tx.player.update({
      where: {
        id: playerWithTeam.id,
      },
      data: {
        isFlaggedForReview: true,
      },
    });

    await recordScanActivityInTransaction(tx, {
      sourceKey: `scan:${scanRecord.id}`,
      eventId: input.eventId,
      teamId: team.id,
      playerId: playerWithTeam.id,
      occurredAt: scanRecord.createdAt,
      scanOutcome: 'INVALID',
      pointsAwarded,
      errorCode: 'QR_NOT_FOUND',
      qrCodeId: null,
      qrCodeLabel: null,
      qrPayload,
      summary: buildScanActivitySummary({
        scanOutcome: 'INVALID',
        qrCodeLabel: null,
        pointsAwarded,
        errorCode: 'QR_NOT_FOUND',
      }),
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
      teamScore: updatedTeam.score,
      errorCode: 'QR_NOT_FOUND',
      flaggedForReview: true,
    };
  }

  if (qrCode.status === 'DISABLED') {
    return createBlockedScanResponse(tx, {
      eventId: input.eventId,
      playerId: playerWithTeam.id,
      teamId: team.id,
      qrCodeId: qrCode.id,
      qrCodeLabel: qrCode.label,
      qrPayload,
      message: 'QR code is disabled by admin control.',
      errorCode: 'QR_DISABLED',
      globalScanCountBefore,
      globalScanCountAfter,
    });
  }

  const baseHazardRatio = resolveHazardRatio(
    qrCode.hazardRatioOverride,
    eventConfig.globalHazardRatio
  );
  const hazardRatioUsed = applyHazardMultiplier(
    baseHazardRatio,
    activeMultiplierRule?.ratioMultiplier ?? null
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
    // Duplicate is determined by unique claim write, avoiding race-prone read-before-write checks.
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
        id: true,
        createdAt: true,
      },
    });

    await recordScanActivityInTransaction(tx, {
      sourceKey: `scan:${scanRecord.id}`,
      eventId: input.eventId,
      teamId: team.id,
      playerId: playerWithTeam.id,
      occurredAt: scanRecord.createdAt,
      scanOutcome: 'DUPLICATE',
      pointsAwarded: 0,
      errorCode: 'ALREADY_CLAIMED',
      qrCodeId: qrCode.id,
      qrCodeLabel: qrCode.label,
      qrPayload,
      summary: buildScanActivitySummary({
        scanOutcome: 'DUPLICATE',
        qrCodeLabel: qrCode.label,
        pointsAwarded: 0,
        errorCode: 'ALREADY_CLAIMED',
      }),
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

  const hazardTriggered = resolveHazardDecision({
    globalScanCountAfter,
    hazardRatioUsed,
    hazardWeightOverride: qrCode.hazardWeightOverride,
  });
  if (hazardTriggered) {
    // Hazard path transitions the team into pit-stop and records team/player state mutation.
    const pitStopExpiresAt = new Date(now.getTime() + eventConfig.pitStopDurationSeconds * 1_000);

    // Guard the status update with a WHERE clause so concurrent scans that
    // simultaneously trigger a hazard are idempotent — only the first writer
    // actually transitions the status; the others see count=0 and skip the
    // state transition records.
    const [pitResult, scanRecord] = await Promise.all([
      tx.team.updateMany({
        where: {
          id: team.id,
          status: { not: 'IN_PIT' },
        },
        data: {
          status: 'IN_PIT',
          pitStopExpiresAt,
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
          id: true,
          createdAt: true,
        },
      }),
    ]);

    const teamAfter = await tx.team.findUnique({
      where: { id: team.id },
      select: { score: true },
    });

    if (pitResult.count > 0) {
      // Only create state transition records when we actually changed the status.
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
    }

    await recordScanActivityInTransaction(tx, {
      sourceKey: `scan:${scanRecord.id}`,
      eventId: input.eventId,
      teamId: team.id,
      playerId: playerWithTeam.id,
      occurredAt: scanRecord.createdAt,
      scanOutcome: 'HAZARD_PIT',
      pointsAwarded: 0,
      errorCode: null,
      qrCodeId: qrCode.id,
      qrCodeLabel: qrCode.label,
      qrPayload,
      summary: buildScanActivitySummary({
        scanOutcome: 'HAZARD_PIT',
        qrCodeLabel: qrCode.label,
        pointsAwarded: 0,
        errorCode: null,
      }),
    });

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
      teamScore: teamAfter!.score,
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
        id: true,
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

  await recordScanActivityInTransaction(tx, {
    sourceKey: `scan:${scanRecord.id}`,
    eventId: input.eventId,
    teamId: team.id,
    playerId: playerWithTeam.id,
    occurredAt: scanRecord.createdAt,
    scanOutcome: 'SAFE',
    pointsAwarded: qrCode.value,
    errorCode: null,
    qrCodeId: qrCode.id,
    qrCodeLabel: qrCode.label,
    qrPayload,
    summary: buildScanActivitySummary({
      scanOutcome: 'SAFE',
      qrCodeLabel: qrCode.label,
      pointsAwarded: qrCode.value,
      errorCode: null,
    }),
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
  readonly qrCodeId: string | null;
  readonly qrCodeLabel: string | null;
  readonly qrPayload: string;
  readonly message: string;
  readonly errorCode: Extract<StableErrorCode, 'QR_DISABLED' | 'RACE_PAUSED' | 'TEAM_IN_PIT'>;
  readonly pitStopExpiresAt?: string | null;
  readonly globalScanCountBefore: number;
  readonly globalScanCountAfter: number;
}

/**
 * Creates a canonical blocked-scan record/response pair.
 */
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
      id: true,
      createdAt: true,
    },
  });

  await recordScanActivityInTransaction(tx, {
    sourceKey: `scan:${scanRecord.id}`,
    eventId: input.eventId,
    teamId: input.teamId,
    playerId: input.playerId,
    occurredAt: scanRecord.createdAt,
    scanOutcome: 'BLOCKED',
    pointsAwarded: 0,
    errorCode: input.errorCode,
    qrCodeId: input.qrCodeId,
    qrCodeLabel: input.qrCodeLabel,
    qrPayload: input.qrPayload,
    summary: buildScanActivitySummary({
      scanOutcome: 'BLOCKED',
      qrCodeLabel: input.qrCodeLabel,
      pointsAwarded: 0,
      errorCode: input.errorCode,
    }),
  });

  if (input.errorCode === 'TEAM_IN_PIT') {
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
      pitStopExpiresAt: input.pitStopExpiresAt ?? null,
    };
  }

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

/**
 * Primary scan ingestion API.
 *
 * Runs inside a ReadCommitted transaction — score increments and QRCodeClaim
 * unique-constraint writes are already race-safe at this level, so Serializable
 * is not required and would only produce unnecessary 40001 conflicts under load.
 * The pit-stop guard uses a conditional `updateMany` to remain idempotent when
 * two concurrent scans both trigger a hazard at the same modulo position.
 */
export async function submitScan(input: SubmitScanInput): Promise<SubmitScanResponse> {
  const qrPayload = input.request.qrPayload.trim();
  if (!qrPayload) {
    throw new ValidationError('QR payload cannot be empty.', {
      eventId: input.eventId,
      playerId: input.request.playerId,
    });
  }

  return withTraceSpan(
    'scan.submit',
    { eventId: input.eventId, playerId: input.request.playerId },
    async () => {
      const result = await runWithSerializationRetry(
        () =>
          prisma.$transaction((tx) => processScanInTransaction(tx, input, qrPayload, new Date())),
        { service: 'scanService' }
      );
      incrementCounter('scan.outcome.total', { outcome: result.outcome });
      return result;
    }
  );
}

/**
 * Backward-compatible adapter for legacy scan contract.
 */
export async function submitLegacyScan(request: ScanHazardRequest): Promise<SubmitScanResponse> {
  return submitScan({
    eventId: request.eventId,
    request: {
      playerId: request.playerId,
      qrPayload: request.qrCode,
    },
  });
}
