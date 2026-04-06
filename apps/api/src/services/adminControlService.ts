import type {
  AdminAuditEntry,
  ManualPitControlRequest,
  ManualPitControlResponse,
  UpdateHeliosRoleRequest,
  UpdateHeliosRoleResponse,
  UpdateRaceControlRequest,
  UpdateRaceControlResponse,
} from '@velocity-gp/api-contract';

import type { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { ValidationError } from '../utils/appError.js';
import {
  publishTeamReleaseEvent,
  releaseTeamFromPitInTransaction,
} from './pitReleaseService.js';

interface AdminActionContext {
  readonly actorUserId?: string;
}

async function resolveActorUserId(
  tx: Prisma.TransactionClient,
  actorUserId: string | undefined
): Promise<string> {
  if (actorUserId) {
    const actor = await tx.user.findUnique({
      where: {
        id: actorUserId,
      },
      select: {
        id: true,
      },
    });

    if (actor) {
      return actor.id;
    }
  }

  const fallbackAdmin = await tx.user.findFirst({
    where: {
      role: 'ADMIN',
    },
    select: {
      id: true,
    },
  });

  if (!fallbackAdmin) {
    throw new ValidationError('Unable to resolve admin actor for this operation.', {
      actorUserId,
    });
  }

  return fallbackAdmin.id;
}

function parsePitStopExpiresAt(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Invalid pit stop expiry timestamp.', {
      pitStopExpiresAt: value,
    });
  }

  return parsed;
}

function jsonDetailsToRecord(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export async function updateRaceControl(
  eventId: string,
  request: UpdateRaceControlRequest,
  context: AdminActionContext = {}
): Promise<UpdateRaceControlResponse> {
  return withTraceSpan('admin.race_control.update', { eventId, state: request.state }, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);

      const existingConfig = await tx.eventConfig.findUnique({
        where: {
          eventId,
        },
        select: {
          raceControlState: true,
        },
      });

      if (!existingConfig) {
        throw new ValidationError('Event configuration does not exist.', { eventId });
      }

      const updatedConfig = await tx.eventConfig.update({
        where: {
          eventId,
        },
        data: {
          raceControlState: request.state,
        },
        select: {
          raceControlState: true,
          updatedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: request.state === 'PAUSED' ? 'RACE_PAUSED' : 'RACE_RESUMED',
          targetType: 'EVENT_CONFIG',
          targetId: eventId,
          details: {
            previousState: existingConfig.raceControlState,
            nextState: request.state,
            reason: request.reason,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId,
        state: updatedConfig.raceControlState,
        updatedAt: updatedConfig.updatedAt.toISOString(),
        auditId: audit.id,
      };
    });

    incrementCounter('admin.race_control.updated', { state: result.state });
    return result;
  });
}

export async function manualPitControl(
  eventId: string,
  teamId: string,
  request: ManualPitControlRequest,
  context: AdminActionContext = {}
): Promise<ManualPitControlResponse> {
  return withTraceSpan(
    'admin.pit_control.update',
    { eventId, teamId, action: request.action },
    async () => {
      let releaseEventToPublish: Awaited<ReturnType<typeof releaseTeamFromPitInTransaction>> = null;
      let publishedReleaseEvent = false;
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);
        const now = new Date();
        const team = await tx.team.findFirst({
          where: {
            id: teamId,
            eventId,
          },
          select: {
            id: true,
            status: true,
            pitStopExpiresAt: true,
          },
        });

        if (!team) {
          throw new ValidationError('Team does not exist for this event.', { eventId, teamId });
        }

        if (request.action === 'ENTER_PIT') {
          const configuredExpiry = parsePitStopExpiresAt(request.pitStopExpiresAt);
          let pitStopExpiresAt = configuredExpiry;
          if (!pitStopExpiresAt) {
            const eventConfig = await tx.eventConfig.findUnique({
              where: {
                eventId,
              },
              select: {
                pitStopDurationSeconds: true,
              },
            });

            if (!eventConfig) {
              throw new ValidationError('Event configuration does not exist.', { eventId });
            }

            pitStopExpiresAt = new Date(now.getTime() + eventConfig.pitStopDurationSeconds * 1_000);
          }

          const updatedTeam = await tx.team.update({
            where: {
              id: team.id,
            },
            data: {
              status: 'IN_PIT',
              pitStopExpiresAt,
            },
            select: {
              status: true,
              pitStopExpiresAt: true,
              updatedAt: true,
            },
          });

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
                eventId,
                teamId: team.id,
                fromStatus: team.status,
                toStatus: 'IN_PIT',
                reason: 'ADMIN_MANUAL',
                triggeredByUserId: actorId,
                notes: request.reason ?? 'Manual pit-stop entry.',
              },
            }),
          ]);

          const audit = await tx.adminActionAudit.create({
            data: {
              eventId,
              actorUserId: actorId,
              actionType: 'PIT_MANUAL_ENTER',
              targetType: 'TEAM',
              targetId: team.id,
              details: {
                reason: request.reason,
                pitStopExpiresAt: pitStopExpiresAt.toISOString(),
              },
            },
            select: {
              id: true,
            },
          });

          return {
            eventId,
            teamId: team.id,
            status: updatedTeam.status,
            pitStopExpiresAt: updatedTeam.pitStopExpiresAt?.toISOString() ?? null,
            updatedAt: updatedTeam.updatedAt.toISOString(),
            auditId: audit.id,
          };
        }

        const releaseEvent = await releaseTeamFromPitInTransaction(tx, {
          eventId,
          teamId: team.id,
          reason: 'ADMIN_MANUAL',
          triggeredByUserId: actorId,
          notes: request.reason ?? 'Manual pit-stop clear.',
          releasedAt: now,
        });

        const updatedTeam = releaseEvent
          ? await tx.team.findUnique({
              where: {
                id: team.id,
              },
              select: {
                status: true,
                pitStopExpiresAt: true,
                updatedAt: true,
              },
            })
          : await tx.team.update({
              where: {
                id: team.id,
              },
              data: {
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              select: {
                status: true,
                pitStopExpiresAt: true,
                updatedAt: true,
              },
            });

        if (!updatedTeam) {
          throw new ValidationError('Unable to load team after pit-stop update.', {
            eventId,
            teamId,
          });
        }

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId,
            actorUserId: actorId,
            actionType: 'PIT_MANUAL_CLEAR',
            targetType: 'TEAM',
            targetId: team.id,
            details: {
              reason: request.reason,
            },
          },
          select: {
            id: true,
          },
        });

        releaseEventToPublish = releaseEvent;

        return {
          eventId,
          teamId: team.id,
          status: updatedTeam.status,
          pitStopExpiresAt: updatedTeam.pitStopExpiresAt?.toISOString() ?? null,
          updatedAt: updatedTeam.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      if (releaseEventToPublish) {
        publishedReleaseEvent = await publishTeamReleaseEvent(releaseEventToPublish);
      }

      incrementCounter('admin.pit_control.updated', {
        action: request.action,
        publishedReleaseEvent,
      });
      return result;
    }
  );
}

export async function updateHeliosRole(
  userId: string,
  request: UpdateHeliosRoleRequest,
  context: AdminActionContext = {}
): Promise<UpdateHeliosRoleResponse> {
  return withTraceSpan(
    'admin.helios_role.update',
    { userId, isHelios: request.isHelios },
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);

        const currentUser = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            role: true,
          },
        });

        if (!currentUser) {
          throw new ValidationError('User does not exist.', { userId });
        }

        const nextRole =
          request.isHelios ? 'HELIOS' : currentUser.role === 'HELIOS' ? 'PLAYER' : currentUser.role;

        const updatedUser = await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            isHelios: request.isHelios,
            role: nextRole,
          },
          select: {
            id: true,
            isHelios: true,
            updatedAt: true,
          },
        });

        const latestEvent = await tx.event.findFirst({
          orderBy: {
            updatedAt: 'desc',
          },
          select: {
            id: true,
          },
        });

        if (!latestEvent) {
          throw new ValidationError('Cannot create audit entry without an event context.', {
            userId,
          });
        }

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId: latestEvent.id,
            actorUserId: actorId,
            actionType: request.isHelios ? 'HELIOS_ASSIGNED' : 'HELIOS_REVOKED',
            targetType: 'USER',
            targetId: userId,
            details: {
              reason: request.reason,
            },
          },
          select: {
            id: true,
          },
        });

        return {
          userId: updatedUser.id,
          isHelios: updatedUser.isHelios,
          updatedAt: updatedUser.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.helios_role.updated', { isHelios: result.isHelios });
      return result;
    }
  );
}

export async function listAdminAudits(eventId: string): Promise<AdminAuditEntry[]> {
  const audits = await prisma.adminActionAudit.findMany({
    where: {
      eventId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      eventId: true,
      actorUserId: true,
      actionType: true,
      targetType: true,
      targetId: true,
      details: true,
      createdAt: true,
    },
  });

  return audits.map((audit) => ({
    id: audit.id,
    eventId: audit.eventId,
    actorUserId: audit.actorUserId,
    actionType: audit.actionType,
    targetType: audit.targetType,
    targetId: audit.targetId,
    details: jsonDetailsToRecord(audit.details),
    createdAt: audit.createdAt.toISOString(),
  }));
}
