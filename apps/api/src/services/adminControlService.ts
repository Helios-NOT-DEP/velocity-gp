import type {
  ListAdminAuditsResponse,
  ManualPitControlRequest,
  ManualPitControlResponse,
  UpdateHeliosRoleRequest,
  UpdateHeliosRoleResponse,
  UpdateQrHazardRandomizerRequest,
  UpdateQrHazardRandomizerResponse,
  UpdateRaceControlRequest,
  UpdateRaceControlResponse,
} from '@velocity-gp/api-contract';

import type { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { ValidationError } from '../utils/appError.js';
import { type AdminActionContext, resolveActorUserId } from '../lib/adminActor.js';
import { publishTeamReleaseEvent, releaseTeamFromPitInTransaction } from './pitReleaseService.js';

/**
 * Admin control service for race state, manual pit operations, Helios role
 * management, hazard randomizer configuration, and admin audit retrieval.
 */

/**
 * Parses an optional pit-stop expiry timestamp from admin requests.
 */
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

/**
 * Safely narrows JSON audit details into a record shape for API responses.
 */
function jsonDetailsToRecord(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

/**
 * Updates race control state for an event and records an admin audit entry.
 */
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

/**
 * Performs admin-driven pit control actions (enter/clear) for a team.
 *
 * Clearing pit may emit a release event to downstream consumers.
 */
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

/**
 * Assigns or revokes Helios role for a user and records an admin audit entry.
 */
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

        const nextRole = request.isHelios
          ? 'HELIOS'
          : currentUser.role === 'HELIOS'
            ? 'PLAYER'
            : currentUser.role;

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

/**
 * Updates per-QR hazard randomizer override for an event-specific QR code.
 */
export async function updateQrHazardRandomizer(
  eventId: string,
  qrCodeId: string,
  request: UpdateQrHazardRandomizerRequest,
  context: AdminActionContext = {}
): Promise<UpdateQrHazardRandomizerResponse> {
  return withTraceSpan(
    'admin.qr_hazard_randomizer.update',
    { eventId, qrCodeId, hazardWeightOverride: request.hazardWeightOverride ?? -1 },
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);

        const qrCode = await tx.qRCode.findFirst({
          where: {
            id: qrCodeId,
            eventId,
            deletedAt: null,
          },
          select: {
            id: true,
            eventId: true,
            hazardWeightOverride: true,
          },
        });

        if (!qrCode) {
          throw new ValidationError('QR code does not exist for this event.', {
            eventId,
            qrCodeId,
          });
        }

        const updatedQrCode = await tx.qRCode.update({
          where: {
            id: qrCode.id,
          },
          data: {
            hazardWeightOverride: request.hazardWeightOverride,
          },
          select: {
            id: true,
            eventId: true,
            hazardWeightOverride: true,
            updatedAt: true,
          },
        });

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId,
            actorUserId: actorId,
            actionType: 'QR_HAZARD_RANDOMIZER_UPDATED',
            targetType: 'QR_CODE',
            targetId: qrCode.id,
            details: {
              previousHazardWeightOverride: qrCode.hazardWeightOverride,
              nextHazardWeightOverride: updatedQrCode.hazardWeightOverride,
            },
          },
          select: {
            id: true,
          },
        });

        return {
          eventId: updatedQrCode.eventId,
          qrCodeId: updatedQrCode.id,
          hazardWeightOverride: updatedQrCode.hazardWeightOverride,
          updatedAt: updatedQrCode.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.qr_hazard_randomizer.updated', {
        overrideMode: result.hazardWeightOverride === null ? 'fallback' : 'weighted',
      });
      return result;
    }
  );
}

/**
 * Lists admin audit records for an event in reverse chronological order.
 * Supports cursor-based pagination to prevent unbounded query sizes.
 */
export async function listAdminAudits(
  eventId: string,
  options: { cursor?: string; limit?: number } = {}
): Promise<ListAdminAuditsResponse> {
  const limit = options.limit ?? 50;

  const audits = await prisma.adminActionAudit.findMany({
    where: { eventId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    // Fetch one extra to determine if there is a next page.
    take: limit + 1,
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
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

  const hasNextPage = audits.length > limit;
  const page = hasNextPage ? audits.slice(0, limit) : audits;
  const nextCursor = hasNextPage ? (page[page.length - 1]?.id ?? null) : null;

  return {
    items: page.map((audit) => ({
      id: audit.id,
      eventId: audit.eventId,
      actorUserId: audit.actorUserId,
      actionType: audit.actionType,
      targetType: audit.targetType,
      targetId: audit.targetId,
      details: jsonDetailsToRecord(audit.details),
      createdAt: audit.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
