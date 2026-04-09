import type { Prisma } from '../../prisma/generated/client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { withTraceSpan } from '../lib/observability.js';

interface MailtrapEventInput {
  readonly eventType: string;
  readonly timestamp?: string;
  readonly recipientEmail: string;
  readonly messageId?: string | null;
  readonly sendingStream?: string | null;
  readonly inboxId?: string | null;
  readonly providerEventId?: string | null;
  readonly eventId?: string | null;
  readonly raw?: Record<string, unknown>;
}

interface IngestMailtrapEventsInput {
  readonly processedAt?: string;
  readonly events: readonly MailtrapEventInput[];
}

interface IngestMailtrapEventsResult {
  readonly accepted: true;
  readonly processedAt: string;
  readonly ingestedCount: number;
  readonly duplicateCount: number;
  readonly returnSignalCount: number;
  readonly flaggedUserCount: number;
  readonly flaggedPlayerCount: number;
  readonly auditCount: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeEventType(eventType: string): string {
  return eventType.trim().toLowerCase();
}

function isBounceReturnSignal(eventType: string): boolean {
  return normalizeEventType(eventType) === 'bounce';
}

const MAILTRAP_AUDIT_ACTOR_DISPLAY_NAME = 'System (Mailtrap Webhook)';

async function resolveAuditActorUserId(tx: Prisma.TransactionClient): Promise<string> {
  const actor = await tx.user.upsert({
    where: {
      email: normalizeEmail(env.MAILTRAP_AUDIT_ACTOR_EMAIL),
    },
    update: {},
    create: {
      email: normalizeEmail(env.MAILTRAP_AUDIT_ACTOR_EMAIL),
      displayName: MAILTRAP_AUDIT_ACTOR_DISPLAY_NAME,
      role: 'HELIOS',
      isHelios: true,
    },
    select: {
      id: true,
    },
  });

  return actor.id;
}

export async function ingestMailtrapEvents(
  input: IngestMailtrapEventsInput
): Promise<IngestMailtrapEventsResult> {
  return withTraceSpan('email.mailtrap.ingest', { eventCount: input.events.length }, async () => {
    let ingestedCount = 0;
    let duplicateCount = 0;
    let returnSignalCount = 0;
    let flaggedUserCount = 0;
    let flaggedPlayerCount = 0;
    let auditCount = 0;

    for (const event of input.events) {
      const normalizedRecipientEmail = normalizeEmail(event.recipientEmail);
      const normalizedEventType = normalizeEventType(event.eventType);
      const returnSignal = isBounceReturnSignal(normalizedEventType);
      const occurredAt = event.timestamp ? new Date(event.timestamp) : new Date();

      if (Number.isNaN(occurredAt.getTime())) {
        continue;
      }

      const result = await prisma.$transaction(async (tx) => {
        const providerEventId = event.providerEventId ?? null;

        if (providerEventId) {
          const existing = await tx.emailEvent.findUnique({
            where: {
              provider_providerEventId: {
                provider: 'MAILTRAP',
                providerEventId,
              },
            },
            select: {
              id: true,
            },
          });

          if (existing) {
            return {
              ingested: false,
              duplicate: true,
              returnSignal: false,
              flaggedUser: false,
              flaggedPlayers: 0,
              audits: 0,
            };
          }
        }

        const user = await tx.user.findUnique({
          where: {
            email: normalizedRecipientEmail,
          },
          select: {
            id: true,
          },
        });

        const playerForEvent = user?.id
          ? await tx.player.findFirst({
              where: {
                userId: user.id,
                ...(event.eventId
                  ? {
                      eventId: event.eventId,
                    }
                  : {}),
              },
              select: {
                id: true,
                eventId: true,
              },
              orderBy: {
                joinedAt: 'desc',
              },
            })
          : null;

        const payload: Prisma.InputJsonValue = {
          raw: (event.raw ?? null) as Prisma.InputJsonValue | null,
          eventType: event.eventType,
          timestamp: event.timestamp ?? null,
        };

        await tx.emailEvent.create({
          data: {
            provider: 'MAILTRAP',
            providerEventId,
            eventType: normalizedEventType,
            occurredAt,
            recipientEmailRaw: event.recipientEmail,
            recipientEmailNormalized: normalizedRecipientEmail,
            messageId: event.messageId ?? null,
            sendingStream: event.sendingStream ?? null,
            inboxId: event.inboxId ?? null,
            isReturnSignal: returnSignal,
            payload,
            eventId: event.eventId ?? playerForEvent?.eventId ?? null,
            userId: user?.id ?? null,
            playerId: playerForEvent?.id ?? null,
          },
        });

        if (!returnSignal || !user?.id) {
          return {
            ingested: true,
            duplicate: false,
            returnSignal: false,
            flaggedUser: false,
            flaggedPlayers: 0,
            audits: 0,
          };
        }

        const actorUserId = await resolveAuditActorUserId(tx);
        const relatedPlayers = await tx.player.findMany({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            eventId: true,
            hasReturnEmailIssue: true,
          },
        });

        const userBefore = await tx.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            hasReturnEmailIssue: true,
          },
        });

        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            hasReturnEmailIssue: true,
          },
        });

        const playerIdsToFlag = relatedPlayers
          .filter((player) => !player.hasReturnEmailIssue)
          .map((player) => player.id);

        if (playerIdsToFlag.length > 0) {
          await tx.player.updateMany({
            where: {
              id: {
                in: playerIdsToFlag,
              },
            },
            data: {
              hasReturnEmailIssue: true,
            },
          });
        }

        let createdAudits = 0;
        for (const player of relatedPlayers) {
          await tx.adminActionAudit.create({
            data: {
              eventId: player.eventId,
              actorUserId,
              actionType: 'EMAIL_RETURN_FLAGGED',
              targetType: 'PLAYER',
              targetId: player.id,
              details: {
                reason: 'mailtrap_bounce',
                initiatedBy: 'SYSTEM_MAILTRAP_WEBHOOK',
                recipientEmail: normalizedRecipientEmail,
                provider: 'MAILTRAP',
                providerEventId,
                messageId: event.messageId ?? null,
              },
            },
          });
          createdAudits += 1;
        }

        return {
          ingested: true,
          duplicate: false,
          returnSignal: true,
          flaggedUser: userBefore ? !userBefore.hasReturnEmailIssue : true,
          flaggedPlayers: playerIdsToFlag.length,
          audits: createdAudits,
        };
      });

      if (result.ingested) {
        ingestedCount += 1;
      }
      if (result.duplicate) {
        duplicateCount += 1;
      }
      if (result.returnSignal) {
        returnSignalCount += 1;
      }
      if (result.flaggedUser) {
        flaggedUserCount += 1;
      }
      flaggedPlayerCount += result.flaggedPlayers;
      auditCount += result.audits;
    }

    return {
      accepted: true,
      processedAt: input.processedAt ?? new Date().toISOString(),
      ingestedCount,
      duplicateCount,
      returnSignalCount,
      flaggedUserCount,
      flaggedPlayerCount,
      auditCount,
    };
  });
}
