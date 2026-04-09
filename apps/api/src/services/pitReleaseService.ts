import type { Prisma } from '../../prisma/generated/client.js';

import { prisma } from '../db/client.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import {
  type PitReleasePublisher,
  type PitReleaseReason,
  type TeamPitReleasedEvent,
  getPitReleasePublisher,
} from './pitReleasePublisher.js';

export interface ReleaseTeamFromPitInput {
  readonly eventId: string;
  readonly teamId: string;
  readonly reason: PitReleaseReason;
  readonly triggeredByUserId?: string;
  readonly triggeredByPlayerId?: string;
  readonly notes?: string;
  readonly releasedAt?: Date;
}

export interface PitReleaseSweepResult {
  readonly scanned: number;
  readonly released: number;
  readonly publishFailures: number;
}

export interface PitReleaseSweepOptions {
  readonly now?: Date;
  readonly batchSize?: number;
  readonly publisher?: PitReleasePublisher;
}

export async function releaseTeamFromPitInTransaction(
  tx: Prisma.TransactionClient,
  input: ReleaseTeamFromPitInput
): Promise<TeamPitReleasedEvent | null> {
  const team = await tx.team.findFirst({
    where: {
      id: input.teamId,
      eventId: input.eventId,
    },
    select: {
      id: true,
      eventId: true,
      status: true,
    },
  });

  if (!team || team.status !== 'IN_PIT') {
    return null;
  }

  const releasedAt = input.releasedAt ?? new Date();

  await tx.team.update({
    where: {
      id: team.id,
    },
    data: {
      status: 'ACTIVE',
      pitStopExpiresAt: null,
    },
  });

  await tx.player.updateMany({
    where: {
      teamId: team.id,
      status: 'IN_PIT',
    },
    data: {
      status: 'RACING',
    },
  });

  await tx.teamStateTransition.create({
    data: {
      eventId: team.eventId,
      teamId: team.id,
      fromStatus: team.status,
      toStatus: 'ACTIVE',
      reason: input.reason,
      triggeredByUserId: input.triggeredByUserId,
      triggeredByPlayerId: input.triggeredByPlayerId,
      notes: input.notes,
      createdAt: releasedAt,
    },
  });

  return {
    eventId: team.eventId,
    teamId: team.id,
    status: 'ACTIVE',
    pitStopExpiresAt: null,
    releasedAt: releasedAt.toISOString(),
    reason: input.reason,
  };
}

export async function publishTeamReleaseEvent(
  event: TeamPitReleasedEvent,
  publisher: PitReleasePublisher = getPitReleasePublisher()
): Promise<boolean> {
  try {
    await publisher.publishTeamReleased(event);
    incrementCounter('pit_release.publish.success', { reason: event.reason });
    return true;
  } catch (error) {
    incrementCounter('pit_release.publish.failure', { reason: event.reason });
    logger.error('failed to publish team pit release event', { err: error, event });
    return false;
  }
}

export async function releaseTeamFromPit(
  input: ReleaseTeamFromPitInput,
  publisher: PitReleasePublisher = getPitReleasePublisher()
): Promise<TeamPitReleasedEvent | null> {
  const releaseEvent = await prisma.$transaction((tx) =>
    releaseTeamFromPitInTransaction(tx, input)
  );

  if (!releaseEvent) {
    return null;
  }

  incrementCounter('pit_release.total', { reason: releaseEvent.reason });
  await publishTeamReleaseEvent(releaseEvent, publisher);
  return releaseEvent;
}

export async function releaseExpiredTeamsFromPit(
  options: PitReleaseSweepOptions = {}
): Promise<PitReleaseSweepResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? env.PIT_RELEASE_BATCH_SIZE;
  const publisher = options.publisher ?? getPitReleasePublisher();

  return withTraceSpan(
    'pit.release.sweep',
    { batchSize, now: now.toISOString() },
    async (): Promise<PitReleaseSweepResult> => {
      const candidates = await prisma.team.findMany({
        where: {
          status: 'IN_PIT',
          pitStopExpiresAt: {
            lte: now,
          },
        },
        orderBy: {
          pitStopExpiresAt: 'asc',
        },
        select: {
          id: true,
          eventId: true,
        },
        take: batchSize,
      });

      let released = 0;
      let publishFailures = 0;

      for (const candidate of candidates) {
        const releaseEvent = await prisma.$transaction((tx) =>
          releaseTeamFromPitInTransaction(tx, {
            eventId: candidate.eventId,
            teamId: candidate.id,
            reason: 'TIMER_EXPIRED',
            notes: 'Automatic pit-stop expiry release.',
            releasedAt: now,
          })
        );

        if (!releaseEvent) {
          continue;
        }

        released += 1;
        incrementCounter('pit_release.total', { reason: releaseEvent.reason });
        const published = await publishTeamReleaseEvent(releaseEvent, publisher);
        if (!published) {
          publishFailures += 1;
        }
      }

      if (released > 0) {
        logger.info('pit release sweep completed', {
          scanned: candidates.length,
          released,
          publishFailures,
        });
      }

      return {
        scanned: candidates.length,
        released,
        publishFailures,
      };
    }
  );
}
