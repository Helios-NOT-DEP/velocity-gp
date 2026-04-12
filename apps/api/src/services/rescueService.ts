import type {
  HeliosRescueFlow,
  InitiateRescueRequest,
  RescueCompletionResponse,
} from '@velocity-gp/api-contract';

import type { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { AppError, NotFoundError, ValidationError } from '../utils/appError.js';
import { publishTeamReleaseEvent, releaseTeamFromPitInTransaction } from './pitReleaseService.js';

/**
 * Helios rescue service.
 *
 * Handles rescue request lifecycle, self-rescue prevention, completion flows,
 * and pit release integration when a rescue is successfully completed.
 */
interface InitiateRescueInput extends InitiateRescueRequest {
  readonly scannerUserId?: string;
}

interface RescuerResolution {
  readonly rescuerUserId: string;
  readonly scannerPlayerId: string | null;
  readonly scannerTeamId: string | null;
}

/**
 * Resolves rescuer identity from scanner context, QR context, explicit IDs, or
 * Helios fallback user.
 */
async function resolveRescuer(
  tx: Prisma.TransactionClient,
  request: InitiateRescueInput
): Promise<RescuerResolution> {
  let scannerPlayer: {
    id: string;
    userId: string;
    teamId: string | null;
  } | null = null;

  if (request.scannerUserId) {
    scannerPlayer = await tx.player.findFirst({
      where: {
        eventId: request.eventId,
        userId: request.scannerUserId,
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
      },
    });
  }

  if (!scannerPlayer && request.heliosQrId) {
    scannerPlayer = await tx.player.findFirst({
      where: {
        eventId: request.eventId,
        id: request.heliosQrId,
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
      },
    });
  }

  if (!scannerPlayer && request.heliosQrId) {
    scannerPlayer = await tx.player.findFirst({
      where: {
        eventId: request.eventId,
        userId: request.heliosQrId,
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
      },
    });
  }

  if (scannerPlayer) {
    return {
      rescuerUserId: scannerPlayer.userId,
      scannerPlayerId: scannerPlayer.id,
      scannerTeamId: scannerPlayer.teamId,
    };
  }

  const explicitUserIdCandidate = request.scannerUserId ?? request.heliosQrId ?? null;
  if (explicitUserIdCandidate) {
    const explicitUser = await tx.user.findUnique({
      where: {
        id: explicitUserIdCandidate,
      },
      select: {
        id: true,
      },
    });

    if (explicitUser) {
      return {
        rescuerUserId: explicitUser.id,
        scannerPlayerId: null,
        scannerTeamId: null,
      };
    }
  }

  const fallbackRescuer = await tx.user.findFirst({
    where: {
      OR: [
        {
          role: 'HELIOS',
        },
        {
          isHeliosMember: true,
        },
        {
          isHelios: true,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!fallbackRescuer) {
    throw new ValidationError('Unable to resolve a rescuer identity for this event.', {
      eventId: request.eventId,
      playerId: request.playerId,
    });
  }

  return {
    rescuerUserId: fallbackRescuer.id,
    scannerPlayerId: null,
    scannerTeamId: null,
  };
}

/**
 * Creates a rescue request after validating player/team membership and
 * self-rescue constraints.
 */
export async function initiateRescue(request: InitiateRescueInput): Promise<HeliosRescueFlow> {
  return withTraceSpan(
    'rescue.initiate',
    { eventId: request.eventId, playerId: request.playerId },
    async () => {
      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const requestingPlayer = await tx.player.findFirst({
          where: {
            id: request.playerId,
            eventId: request.eventId,
          },
          include: {
            team: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!requestingPlayer || !requestingPlayer.teamId || !requestingPlayer.team) {
          throw new ValidationError('Requesting player must exist and belong to a team.', {
            eventId: request.eventId,
            playerId: request.playerId,
          });
        }

        const rescuer = await resolveRescuer(tx, request);
        const selfRescueForbidden =
          rescuer.scannerTeamId !== null && rescuer.scannerTeamId === requestingPlayer.teamId;

        if (selfRescueForbidden) {
          const rejectedRescue = await tx.rescue.create({
            data: {
              eventId: request.eventId,
              requestingPlayerId: requestingPlayer.id,
              requestingTeamId: requestingPlayer.teamId,
              rescuerUserId: rescuer.rescuerUserId,
              status: 'REJECTED',
              reason: 'SELF_RESCUE_FORBIDDEN',
              initiatedAt: now,
              completedAt: null,
              cooldownExpiresAt: null,
            },
            select: {
              id: true,
            },
          });

          return {
            outcome: 'REJECTED' as const,
            rescueId: rejectedRescue.id,
          };
        }

        const createdRescue = await tx.rescue.create({
          data: {
            eventId: request.eventId,
            requestingPlayerId: requestingPlayer.id,
            requestingTeamId: requestingPlayer.teamId,
            rescuerUserId: rescuer.rescuerUserId,
            status: 'REQUESTED',
            reason: request.reason,
            initiatedAt: now,
            completedAt: null,
            cooldownExpiresAt: null,
          },
          select: {
            id: true,
            eventId: true,
            requestingPlayerId: true,
            rescuerUserId: true,
            initiatedAt: true,
            completedAt: true,
            status: true,
          },
        });

        return {
          outcome: 'CREATED' as const,
          rescue: createdRescue,
        };
      });

      if (result.outcome === 'REJECTED') {
        incrementCounter('rescue.reject.total', { reason: 'SELF_RESCUE_FORBIDDEN' });
        throw new AppError(
          409,
          'SELF_RESCUE_FORBIDDEN',
          'Scanner and scannee cannot belong to the same team.',
          {
            eventId: request.eventId,
            playerId: request.playerId,
            rescueId: result.rescueId,
          }
        );
      }

      incrementCounter('rescue.request.total', { status: result.rescue.status });
      return {
        id: result.rescue.id,
        playerId: result.rescue.requestingPlayerId,
        eventId: result.rescue.eventId,
        rescuerUserId: result.rescue.rescuerUserId,
        initiatedAt: result.rescue.initiatedAt.toISOString(),
        completedAt: result.rescue.completedAt?.toISOString() ?? null,
        status: result.rescue.status,
      };
    }
  );
}

/**
 * Returns the most recent rescue state for a player.
 *
 * Falls back to deterministic placeholder data when no persisted rescue exists.
 */
export async function getRescueStatus(playerId: string): Promise<HeliosRescueFlow> {
  const latestRescue = await prisma.rescue.findFirst({
    where: {
      requestingPlayerId: playerId,
    },
    orderBy: {
      initiatedAt: 'desc',
    },
    select: {
      id: true,
      requestingPlayerId: true,
      eventId: true,
      rescuerUserId: true,
      initiatedAt: true,
      completedAt: true,
      status: true,
    },
  });

  if (latestRescue) {
    return {
      id: latestRescue.id,
      playerId: latestRescue.requestingPlayerId,
      eventId: latestRescue.eventId,
      rescuerUserId: latestRescue.rescuerUserId,
      initiatedAt: latestRescue.initiatedAt.toISOString(),
      completedAt: latestRescue.completedAt?.toISOString() ?? null,
      status: latestRescue.status,
    };
  }

  throw new NotFoundError('No rescue record found for this player.', { playerId });
}

/**
 * Completes the active rescue for a player and releases the associated team from
 * pit when applicable.
 */
export async function completeRescue(playerId: string): Promise<RescueCompletionResponse> {
  return withTraceSpan('rescue.complete', { playerId }, async () => {
    let releaseEvent: Awaited<ReturnType<typeof releaseTeamFromPitInTransaction>> = null;

    const completion = await prisma.$transaction(async (tx) => {
      const activeRescue = await tx.rescue.findFirst({
        where: {
          requestingPlayerId: playerId,
          status: {
            in: ['REQUESTED', 'IN_PROGRESS'],
          },
        },
        orderBy: {
          initiatedAt: 'desc',
        },
        select: {
          id: true,
          eventId: true,
          requestingPlayerId: true,
          requestingTeamId: true,
          rescuerUserId: true,
        },
      });

      if (!activeRescue) {
        const completedRescue = await tx.rescue.findFirst({
          where: {
            requestingPlayerId: playerId,
            status: 'COMPLETED',
          },
          orderBy: {
            completedAt: 'desc',
          },
          select: {
            requestingPlayerId: true,
            completedAt: true,
          },
        });

        if (!completedRescue || !completedRescue.completedAt) {
          throw new ValidationError('No active rescue was found for this player.', {
            playerId,
          });
        }

        return {
          playerId: completedRescue.requestingPlayerId,
          completedAt: completedRescue.completedAt,
        };
      }

      const completedAt = new Date();

      await tx.rescue.update({
        where: {
          id: activeRescue.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt,
        },
      });

      releaseEvent = await releaseTeamFromPitInTransaction(tx, {
        eventId: activeRescue.eventId,
        teamId: activeRescue.requestingTeamId,
        reason: 'RESCUE_CLEARED',
        triggeredByUserId: activeRescue.rescuerUserId,
        notes: 'Rescue completion released team from pit stop.',
        releasedAt: completedAt,
      });

      return {
        playerId: activeRescue.requestingPlayerId,
        completedAt,
      };
    });

    if (releaseEvent) {
      await publishTeamReleaseEvent(releaseEvent);
    }

    incrementCounter('rescue.complete.total', { releasedTeam: Boolean(releaseEvent) });
    return {
      playerId: completion.playerId,
      completedAt: completion.completedAt.toISOString(),
      status: 'COMPLETED',
    };
  });
}
