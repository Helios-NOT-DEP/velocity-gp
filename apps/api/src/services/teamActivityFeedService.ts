import type {
  ListTeamActivityFeedResponse,
  ScanOutcome,
  StableErrorCode,
  TeamActivityFeedItem,
} from '@velocity-gp/api-contract';
import type { Prisma } from '../../prisma/generated/client.js';

import { prisma } from '../db/client.js';
import { withTraceSpan } from '../lib/observability.js';

const DEFAULT_FEED_LIMIT = 25;
const MAX_FEED_LIMIT = 100;
const STABLE_ERROR_CODES = new Set<StableErrorCode>([
  'SELF_RESCUE_FORBIDDEN',
  'RACE_PAUSED',
  'QR_DISABLED',
  'QR_NOT_FOUND',
  'ALREADY_CLAIMED',
  'TEAM_IN_PIT',
  'HELIOS_COOLDOWN_ACTIVE',
  'NO_ACTIVE_PIT',
]);

export interface RecordOnboardingCompletedActivityInput {
  readonly eventId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly occurredAt?: Date;
}

export interface RecordScanActivityInTransactionInput {
  readonly sourceKey: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly occurredAt: Date;
  readonly scanOutcome: ScanOutcome;
  readonly pointsAwarded: number;
  readonly errorCode: StableErrorCode | null;
  readonly qrCodeId: string | null;
  readonly qrCodeLabel: string | null;
  readonly qrPayload: string;
  readonly summary: string;
}

function clampFeedLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_FEED_LIMIT;
  }

  return Math.max(1, Math.min(MAX_FEED_LIMIT, Math.floor(limit)));
}

function toStableErrorCodeOrNull(errorCode: string | null): StableErrorCode | null {
  if (!errorCode) {
    return null;
  }

  return STABLE_ERROR_CODES.has(errorCode as StableErrorCode)
    ? (errorCode as StableErrorCode)
    : null;
}

export function buildScanActivitySummary(input: {
  readonly scanOutcome: ScanOutcome;
  readonly qrCodeLabel: string | null;
  readonly pointsAwarded: number;
  readonly errorCode: StableErrorCode | null;
}): string {
  const qrLabel = input.qrCodeLabel ?? 'Unknown QR';

  if (input.scanOutcome === 'SAFE') {
    const signedPoints = input.pointsAwarded >= 0 ? `+${input.pointsAwarded}` : input.pointsAwarded;
    return `${qrLabel} scanned for ${signedPoints} points.`;
  }

  if (input.scanOutcome === 'HAZARD_PIT') {
    return `${qrLabel} triggered a hazard and sent the team to pit stop.`;
  }

  if (input.scanOutcome === 'INVALID') {
    return 'Invalid QR scanned. Player flagged for review.';
  }

  if (input.scanOutcome === 'DUPLICATE') {
    return `${qrLabel} was already claimed by this player.`;
  }

  return `${qrLabel} scan was blocked${input.errorCode ? ` (${input.errorCode}).` : '.'}`;
}

/**
 * Idempotently records the point where a player is race-ready on an active team.
 */
export async function recordOnboardingCompletedActivity(
  input: RecordOnboardingCompletedActivityInput
): Promise<void> {
  await withTraceSpan(
    'team_activity.onboarding.record',
    { eventId: input.eventId, teamId: input.teamId, playerId: input.playerId },
    async () => {
      const occurredAt = input.occurredAt ?? new Date();
      const sourceKey = `onboarding_completed:${input.playerId}:team:${input.teamId}`;

      await prisma.teamActivityEvent.createMany({
        data: [
          {
            eventId: input.eventId,
            teamId: input.teamId,
            playerId: input.playerId,
            type: 'PLAYER_ONBOARDING_COMPLETED',
            sourceKey,
            summary: `${input.playerName} completed onboarding and is now race-ready.`,
            occurredAt,
          },
        ],
        skipDuplicates: true,
      });
    }
  );
}

/**
 * Records a single scan-driven activity event inside the caller transaction.
 */
export async function recordScanActivityInTransaction(
  tx: Prisma.TransactionClient,
  input: RecordScanActivityInTransactionInput
): Promise<void> {
  await tx.teamActivityEvent.create({
    data: {
      eventId: input.eventId,
      teamId: input.teamId,
      playerId: input.playerId,
      qrCodeId: input.qrCodeId,
      type: 'PLAYER_QR_SCAN',
      sourceKey: input.sourceKey,
      scanOutcome: input.scanOutcome,
      pointsAwarded: input.pointsAwarded,
      errorCode: input.errorCode,
      qrCodeLabel: input.qrCodeLabel,
      qrPayload: input.qrPayload,
      summary: input.summary,
      occurredAt: input.occurredAt,
    },
  });
}

/**
 * Lists the latest activity feed entries for one team in one event.
 */
export async function listTeamActivityFeed(
  eventId: string,
  teamId: string,
  limit?: number
): Promise<ListTeamActivityFeedResponse> {
  const take = clampFeedLimit(limit);

  return withTraceSpan('team_activity.feed.list', { eventId, teamId, limit: take }, async () => {
    const rows = await prisma.teamActivityEvent.findMany({
      where: {
        eventId,
        teamId,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take,
      select: {
        id: true,
        eventId: true,
        teamId: true,
        playerId: true,
        type: true,
        occurredAt: true,
        summary: true,
        scanOutcome: true,
        pointsAwarded: true,
        errorCode: true,
        qrCodeId: true,
        qrCodeLabel: true,
        qrPayload: true,
        player: {
          select: {
            user: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    const items: TeamActivityFeedItem[] = rows.map((row) => {
      const base = {
        id: row.id,
        eventId: row.eventId,
        teamId: row.teamId,
        playerId: row.playerId,
        playerName: row.player.user.displayName,
        occurredAt: row.occurredAt.toISOString(),
      };

      if (row.type === 'PLAYER_ONBOARDING_COMPLETED') {
        return {
          ...base,
          type: 'PLAYER_ONBOARDING_COMPLETED',
          summary: row.summary,
        };
      }

      return {
        ...base,
        type: 'PLAYER_QR_SCAN',
        qrCodeId: row.qrCodeId,
        qrCodeLabel: row.qrCodeLabel,
        qrPayload: row.qrPayload ?? '',
        scanOutcome: row.scanOutcome ?? 'BLOCKED',
        pointsAwarded: row.pointsAwarded ?? 0,
        errorCode: toStableErrorCodeOrNull(row.errorCode),
        summary: row.summary,
      };
    });

    return { items };
  });
}
