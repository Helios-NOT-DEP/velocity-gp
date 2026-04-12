import type {
  CreateHazardMultiplierRuleRequest,
  CreateHazardMultiplierRuleResponse,
  DeleteHazardMultiplierRuleResponse,
  GetEventHazardSettingsResponse,
  HazardMultiplierRule,
  ListAdminAuditsResponse,
  ListHazardMultiplierRulesResponse,
  ManualPitControlRequest,
  ManualPitControlResponse,
  UpdateEventHazardSettingsRequest,
  UpdateEventHazardSettingsResponse,
  UpdateHazardMultiplierRuleRequest,
  UpdateHazardMultiplierRuleResponse,
  UpdateHeliosRoleRequest,
  UpdateHeliosRoleResponse,
  UpdateUserCapabilitiesRequest,
  UpdateUserCapabilitiesResponse,
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

function toIso(value: Date): string {
  return value.toISOString();
}

function parseIsoDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid ${fieldName} timestamp.`, {
      [fieldName]: value,
    });
  }
  return parsed;
}

function toHazardMultiplierRuleRecord(row: {
  id: string;
  eventId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  ratioMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}): HazardMultiplierRule {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    ratioMultiplier: row.ratioMultiplier,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function ensureNoMultiplierOverlap(
  tx: Prisma.TransactionClient,
  input: {
    eventId: string;
    startsAt: Date;
    endsAt: Date;
    excludeRuleId?: string;
  }
): Promise<void> {
  const overlappingRule = await tx.hazardMultiplierRule.findFirst({
    where: {
      eventId: input.eventId,
      deletedAt: null,
      ...(input.excludeRuleId ? { id: { not: input.excludeRuleId } } : {}),
      startsAt: {
        lt: input.endsAt,
      },
      endsAt: {
        gt: input.startsAt,
      },
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (overlappingRule) {
    throw new ValidationError('Hazard multiplier rule overlaps an existing time window.', {
      overlappingRuleId: overlappingRule.id,
      overlappingRuleName: overlappingRule.name,
      overlappingStartsAt: overlappingRule.startsAt.toISOString(),
      overlappingEndsAt: overlappingRule.endsAt.toISOString(),
    });
  }
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

function deriveLegacyRoleFromCapabilities(input: {
  admin: boolean;
  player: boolean;
  heliosMember: boolean;
}): 'ADMIN' | 'HELIOS' | 'PLAYER' {
  if (input.player && input.heliosMember) {
    return 'HELIOS';
  }

  if (input.player) {
    return 'PLAYER';
  }

  return 'ADMIN';
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

export async function getEventHazardSettings(
  eventId: string
): Promise<GetEventHazardSettingsResponse> {
  const config = await prisma.eventConfig.findUnique({
    where: {
      eventId,
    },
    select: {
      eventId: true,
      globalHazardRatio: true,
      updatedAt: true,
    },
  });

  if (!config) {
    throw new ValidationError('Event configuration does not exist.', { eventId });
  }

  return {
    eventId: config.eventId,
    globalHazardRatio: config.globalHazardRatio,
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function updateEventHazardSettings(
  eventId: string,
  request: UpdateEventHazardSettingsRequest,
  context: AdminActionContext = {}
): Promise<UpdateEventHazardSettingsResponse> {
  return withTraceSpan(
    'admin.hazard_settings.update',
    { eventId, globalHazardRatio: request.globalHazardRatio },
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);
        const existing = await tx.eventConfig.findUnique({
          where: {
            eventId,
          },
          select: {
            eventId: true,
            globalHazardRatio: true,
          },
        });

        if (!existing) {
          throw new ValidationError('Event configuration does not exist.', { eventId });
        }

        const updated = await tx.eventConfig.update({
          where: {
            eventId,
          },
          data: {
            globalHazardRatio: request.globalHazardRatio,
          },
          select: {
            eventId: true,
            globalHazardRatio: true,
            updatedAt: true,
          },
        });

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId,
            actorUserId: actorId,
            actionType: 'EVENT_HAZARD_SETTINGS_UPDATED',
            targetType: 'EVENT_CONFIG',
            targetId: eventId,
            details: {
              previousGlobalHazardRatio: existing.globalHazardRatio,
              nextGlobalHazardRatio: updated.globalHazardRatio,
              reason: request.reason,
            },
          },
          select: {
            id: true,
          },
        });

        return {
          eventId: updated.eventId,
          globalHazardRatio: updated.globalHazardRatio,
          updatedAt: updated.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.hazard_settings.updated', {
        globalHazardRatio: result.globalHazardRatio,
      });
      return result;
    }
  );
}

export async function listHazardMultiplierRules(
  eventId: string
): Promise<ListHazardMultiplierRulesResponse> {
  const rules = await prisma.hazardMultiplierRule.findMany({
    where: {
      eventId,
      deletedAt: null,
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      eventId: true,
      name: true,
      startsAt: true,
      endsAt: true,
      ratioMultiplier: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    eventId,
    rules: rules.map(toHazardMultiplierRuleRecord),
  };
}

export async function createHazardMultiplierRule(
  eventId: string,
  request: CreateHazardMultiplierRuleRequest,
  context: AdminActionContext = {}
): Promise<CreateHazardMultiplierRuleResponse> {
  return withTraceSpan('admin.hazard_multiplier.create', { eventId }, async () => {
    const startsAt = parseIsoDate(request.startsAt, 'startsAt');
    const endsAt = parseIsoDate(request.endsAt, 'endsAt');
    if (startsAt.getTime() >= endsAt.getTime()) {
      throw new ValidationError('endsAt must be later than startsAt.', {
        startsAt: request.startsAt,
        endsAt: request.endsAt,
      });
    }

    return prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);
      await ensureNoMultiplierOverlap(tx, { eventId, startsAt, endsAt });

      const created = await tx.hazardMultiplierRule.create({
        data: {
          eventId,
          name: request.name.trim(),
          startsAt,
          endsAt,
          ratioMultiplier: request.ratioMultiplier,
        },
        select: {
          id: true,
          eventId: true,
          name: true,
          startsAt: true,
          endsAt: true,
          ratioMultiplier: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'HAZARD_MULTIPLIER_CREATED',
          targetType: 'HAZARD_MULTIPLIER_RULE',
          targetId: created.id,
          details: {
            name: created.name,
            startsAt: toIso(created.startsAt),
            endsAt: toIso(created.endsAt),
            ratioMultiplier: created.ratioMultiplier,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        rule: toHazardMultiplierRuleRecord(created),
        auditId: audit.id,
      };
    });
  });
}

export async function updateHazardMultiplierRule(
  eventId: string,
  ruleId: string,
  request: UpdateHazardMultiplierRuleRequest,
  context: AdminActionContext = {}
): Promise<UpdateHazardMultiplierRuleResponse> {
  return withTraceSpan('admin.hazard_multiplier.update', { eventId, ruleId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);
      const existing = await tx.hazardMultiplierRule.findFirst({
        where: {
          id: ruleId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventId: true,
          name: true,
          startsAt: true,
          endsAt: true,
          ratioMultiplier: true,
        },
      });

      if (!existing) {
        throw new ValidationError('Hazard multiplier rule does not exist for this event.', {
          eventId,
          ruleId,
        });
      }

      const nextStartsAt = request.startsAt
        ? parseIsoDate(request.startsAt, 'startsAt')
        : existing.startsAt;
      const nextEndsAt = request.endsAt ? parseIsoDate(request.endsAt, 'endsAt') : existing.endsAt;
      if (nextStartsAt.getTime() >= nextEndsAt.getTime()) {
        throw new ValidationError('endsAt must be later than startsAt.', {
          startsAt: nextStartsAt.toISOString(),
          endsAt: nextEndsAt.toISOString(),
        });
      }

      await ensureNoMultiplierOverlap(tx, {
        eventId,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        excludeRuleId: existing.id,
      });

      const updated = await tx.hazardMultiplierRule.update({
        where: {
          id: existing.id,
        },
        data: {
          name: request.name?.trim() ?? existing.name,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          ratioMultiplier: request.ratioMultiplier ?? existing.ratioMultiplier,
        },
        select: {
          id: true,
          eventId: true,
          name: true,
          startsAt: true,
          endsAt: true,
          ratioMultiplier: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'HAZARD_MULTIPLIER_UPDATED',
          targetType: 'HAZARD_MULTIPLIER_RULE',
          targetId: existing.id,
          details: {
            previous: {
              name: existing.name,
              startsAt: toIso(existing.startsAt),
              endsAt: toIso(existing.endsAt),
              ratioMultiplier: existing.ratioMultiplier,
            },
            next: {
              name: updated.name,
              startsAt: toIso(updated.startsAt),
              endsAt: toIso(updated.endsAt),
              ratioMultiplier: updated.ratioMultiplier,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return {
        rule: toHazardMultiplierRuleRecord(updated),
        auditId: audit.id,
      };
    });
  });
}

export async function deleteHazardMultiplierRule(
  eventId: string,
  ruleId: string,
  context: AdminActionContext = {}
): Promise<DeleteHazardMultiplierRuleResponse> {
  return withTraceSpan('admin.hazard_multiplier.delete', { eventId, ruleId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);
      const existing = await tx.hazardMultiplierRule.findFirst({
        where: {
          id: ruleId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!existing) {
        throw new ValidationError('Hazard multiplier rule does not exist for this event.', {
          eventId,
          ruleId,
        });
      }

      const deletedAt = new Date();
      await tx.hazardMultiplierRule.update({
        where: {
          id: existing.id,
        },
        data: {
          deletedAt,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'HAZARD_MULTIPLIER_DELETED',
          targetType: 'HAZARD_MULTIPLIER_RULE',
          targetId: existing.id,
          details: {
            name: existing.name,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        id: existing.id,
        eventId,
        deletedAt: deletedAt.toISOString(),
        auditId: audit.id,
      };
    });
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
 * Updates account capabilities and records an admin audit entry.
 */
export async function updateUserCapabilities(
  userId: string,
  request: UpdateUserCapabilitiesRequest,
  context: AdminActionContext = {}
): Promise<UpdateUserCapabilitiesResponse> {
  return withTraceSpan(
    'admin.user_capabilities.update',
    {
      userId,
      admin: request.capabilities.admin,
      player: request.capabilities.player,
      heliosMember: request.capabilities.heliosMember,
    },
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);

        const currentUser = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            canAdmin: true,
            canPlayer: true,
            isHeliosMember: true,
            role: true,
            isHelios: true,
          },
        });

        if (!currentUser) {
          throw new ValidationError('User does not exist.', { userId });
        }

        const nextCapabilities = {
          admin: request.capabilities.admin,
          player: request.capabilities.player,
          heliosMember: request.capabilities.heliosMember,
        };
        const nextLegacyRole = deriveLegacyRoleFromCapabilities(nextCapabilities);

        const updatedUser = await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            canAdmin: nextCapabilities.admin,
            canPlayer: nextCapabilities.player,
            isHeliosMember: nextCapabilities.heliosMember,
            role: nextLegacyRole,
            isHelios: nextCapabilities.heliosMember,
          },
          select: {
            id: true,
            canAdmin: true,
            canPlayer: true,
            isHeliosMember: true,
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

        const heliosChanged =
          currentUser.isHeliosMember !== nextCapabilities.heliosMember ||
          currentUser.isHelios !== nextCapabilities.heliosMember ||
          currentUser.role === 'HELIOS' ||
          nextLegacyRole === 'HELIOS';

        const actionType = heliosChanged
          ? nextCapabilities.heliosMember
            ? 'HELIOS_ASSIGNED'
            : 'HELIOS_REVOKED'
          : 'USER_CAPABILITIES_UPDATED';

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId: latestEvent.id,
            actorUserId: actorId,
            actionType,
            targetType: 'USER',
            targetId: userId,
            details: {
              reason: request.reason,
              previousCapabilities: {
                admin: currentUser.canAdmin,
                player: currentUser.canPlayer,
                heliosMember: currentUser.isHeliosMember || currentUser.isHelios,
              },
              nextCapabilities,
              previousRole: currentUser.role,
              nextRole: nextLegacyRole,
            },
          },
          select: {
            id: true,
          },
        });

        return {
          userId: updatedUser.id,
          capabilities: {
            admin: updatedUser.canAdmin,
            player: updatedUser.canPlayer,
            heliosMember: updatedUser.isHeliosMember,
          },
          updatedAt: updatedUser.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.user_capabilities.updated', result.capabilities);
      return result;
    }
  );
}

/**
 * Compatibility wrapper for legacy Helios toggle endpoint.
 */
export async function updateHeliosRole(
  userId: string,
  request: UpdateHeliosRoleRequest,
  context: AdminActionContext = {}
): Promise<UpdateHeliosRoleResponse> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      canAdmin: true,
      canPlayer: true,
      isHeliosMember: true,
      role: true,
      isHelios: true,
    },
  });

  if (!currentUser) {
    throw new ValidationError('User does not exist.', { userId });
  }

  const previousPlayerCapability =
    currentUser.canPlayer || currentUser.role === 'PLAYER' || currentUser.role === 'HELIOS';
  const update = await updateUserCapabilities(
    userId,
    {
      capabilities: {
        admin: currentUser.canAdmin || currentUser.role === 'ADMIN',
        player: request.isHelios ? true : previousPlayerCapability,
        heliosMember: request.isHelios,
      },
      reason: request.reason,
    },
    context
  );

  incrementCounter('admin.helios_role.updated', { isHelios: request.isHelios });
  return {
    userId: update.userId,
    isHelios: update.capabilities.heliosMember,
    capabilities: update.capabilities,
    updatedAt: update.updatedAt,
    auditId: update.auditId,
  };
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
    {
      eventId,
      qrCodeId,
      hazardRatioOverride: request.hazardRatioOverride ?? -1,
      hazardWeightOverride: request.hazardWeightOverride ?? -1,
    },
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
            hazardRatioOverride: true,
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
            ...(Object.prototype.hasOwnProperty.call(request, 'hazardRatioOverride')
              ? { hazardRatioOverride: request.hazardRatioOverride ?? null }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(request, 'hazardWeightOverride')
              ? { hazardWeightOverride: request.hazardWeightOverride ?? null }
              : {}),
          },
          select: {
            id: true,
            eventId: true,
            hazardRatioOverride: true,
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
              previousHazardRatioOverride: qrCode.hazardRatioOverride,
              nextHazardRatioOverride: updatedQrCode.hazardRatioOverride,
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
          hazardRatioOverride: updatedQrCode.hazardRatioOverride,
          hazardWeightOverride: updatedQrCode.hazardWeightOverride,
          updatedAt: updatedQrCode.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.qr_hazard_randomizer.updated', {
        ratioMode: result.hazardRatioOverride === null ? 'event_default' : 'per_qr',
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
