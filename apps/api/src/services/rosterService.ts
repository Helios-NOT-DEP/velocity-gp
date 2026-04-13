import type {
  AdminPlayerScanHistoryItem,
  AdminRosterRow,
  DeleteAdminTeamResponse,
  GetAdminPlayerDetailResponse,
  GetAdminTeamDetailResponse,
  ListAdminPlayerScanHistoryQuery,
  ListAdminPlayerScanHistoryResponse,
  ListAdminRosterQuery,
  ListAdminRosterResponse,
  ListAdminRosterTeamsResponse,
  RosterImportAction,
  RosterImportApplyRequest,
  RosterImportApplyResponse,
  RosterImportPreviewRequest,
  RosterImportPreviewResponse,
  RosterImportPreviewRow,
  UpdateAdminPlayerContactRequest,
  UpdateAdminPlayerContactResponse,
  UpdateAdminTeamScoreRequest,
  UpdateAdminTeamScoreResponse,
  UpdateRosterAssignmentRequest,
  UpdateRosterAssignmentResponse,
} from '@velocity-gp/api-contract';

import type { Prisma } from '../../prisma/generated/client.js';
import { prisma } from '../db/client.js';
import { withTraceSpan } from '../lib/observability.js';
import { ValidationError } from '../utils/appError.js';
import { type AdminActionContext, resolveActorUserId } from '../lib/adminActor.js';
import { normalizeWorkEmail } from '../utils/normalizeEmail.js';

/**
 * Admin roster service for listing, assignment updates, and CSV-style import
 * preview/apply flows.
 */

interface RosterPlayerRecord {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly teamId: string | null;
  readonly status: 'RACING' | 'IN_PIT' | 'FINISHED';
  readonly joinedAt: Date;
  readonly updatedAt: Date;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly isHelios: boolean;
    readonly phoneE164: string | null;
  };
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly status: 'PENDING' | 'ACTIVE' | 'IN_PIT';
  } | null;
}

interface ResolvedImportRow {
  readonly rowNumber: number;
  readonly workEmail: string;
  readonly normalizedWorkEmail: string;
  readonly displayName: string;
  readonly phoneE164: string | null;
  readonly teamName: string | null;
  readonly action: RosterImportAction;
  readonly errors: string[];
  readonly existingUserId: string | null;
  readonly existingPlayerId: string | null;
  readonly existingTeamId: string | null;
  readonly targetTeamNameNormalized: string | null;
}

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;

function normalizeOptionalName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalPhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeTeamKey(teamName: string): string {
  return teamName.trim().toLowerCase();
}

function findRankById<T extends { id: string }>(rows: readonly T[], id: string): number | null {
  const index = rows.findIndex((row) => row.id === id);
  return index >= 0 ? index + 1 : null;
}

function mapScanHistoryRow(row: {
  id: string;
  eventId: string;
  playerId: string;
  teamId: string | null;
  qrCodeId: string | null;
  scannedPayload: string;
  outcome: AdminPlayerScanHistoryItem['outcome'];
  pointsAwarded: number;
  createdAt: Date;
  message: string | null;
  qrCode: {
    label: string;
  } | null;
}): AdminPlayerScanHistoryItem {
  return {
    scanId: row.id,
    eventId: row.eventId,
    playerId: row.playerId,
    teamId: row.teamId,
    qrCodeId: row.qrCodeId,
    qrCodeLabel: row.qrCode?.label ?? null,
    qrPayload: row.scannedPayload,
    outcome: row.outcome,
    pointsAwarded: row.pointsAwarded,
    scannedAt: row.createdAt.toISOString(),
    message: row.message,
  };
}

/**
 * Derives assignment status from team relationship and team state.
 */
function resolveAssignmentStatus(team: { status: 'PENDING' | 'ACTIVE' | 'IN_PIT' } | null) {
  if (!team) {
    return 'UNASSIGNED' as const;
  }

  if (team.status === 'PENDING') {
    return 'ASSIGNED_PENDING' as const;
  }

  return 'ASSIGNED_ACTIVE' as const;
}

/**
 * Maps internal player+user+team joins to API roster rows.
 */
function mapRosterRow(player: RosterPlayerRecord): AdminRosterRow {
  return {
    playerId: player.id,
    userId: player.user.id,
    eventId: player.eventId,
    workEmail: player.user.email,
    displayName: player.user.displayName,
    isHelios: player.user.isHelios,
    phoneE164: player.user.phoneE164,
    teamId: player.team?.id ?? null,
    teamName: player.team?.name ?? null,
    teamStatus: player.team?.status ?? null,
    assignmentStatus: resolveAssignmentStatus(player.team),
    joinedAt: player.joinedAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
  };
}

function resolvePlayerStatusFromTeamStatus(teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null) {
  if (teamStatus === 'IN_PIT') {
    return 'IN_PIT' as const;
  }

  return 'RACING' as const;
}

/**
 * Builds roster filtering predicates for search/team/status query params.
 */
function buildRosterWhereClause(
  eventId: string,
  query: ListAdminRosterQuery
): Prisma.PlayerWhereInput {
  const where: Prisma.PlayerWhereInput = {
    eventId,
    AND: [
      {
        OR: [
          {
            teamId: null,
          },
          {
            team: {
              is: {
                deletedAt: null,
              },
            },
          },
        ],
      },
    ],
  };

  if (query.q) {
    const q = query.q.trim();
    if (q.length > 0) {
      where.OR = [
        {
          user: {
            email: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            displayName: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          team: {
            is: {
              deletedAt: null,
              name: {
                contains: q,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }
  }

  if (query.teamId) {
    where.teamId = query.teamId;
  }

  if (query.assignmentStatus === 'UNASSIGNED') {
    where.teamId = null;
  }

  if (query.assignmentStatus === 'ASSIGNED_PENDING') {
    where.team = {
      is: {
        deletedAt: null,
        status: 'PENDING',
      },
    };
  }

  if (query.assignmentStatus === 'ASSIGNED_ACTIVE') {
    where.team = {
      is: {
        deletedAt: null,
        status: {
          in: ['ACTIVE', 'IN_PIT'],
        },
      },
    };
  }

  return where;
}

/**
 * Lists roster rows for admin surfaces with cursor pagination.
 */
export async function listAdminRoster(
  eventId: string,
  query: ListAdminRosterQuery
): Promise<ListAdminRosterResponse> {
  return withTraceSpan('admin.roster.list', { eventId }, async () => {
    const limit = query.limit ?? 50;
    const players = await prisma.player.findMany({
      where: buildRosterWhereClause(eventId, query),
      orderBy: [
        {
          joinedAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      ...(query.cursor
        ? {
            cursor: {
              id: query.cursor,
            },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      select: {
        id: true,
        userId: true,
        eventId: true,
        teamId: true,
        status: true,
        joinedAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isHelios: true,
            phoneE164: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    const hasMore = players.length > limit;
    const sliced = hasMore ? players.slice(0, limit) : players;

    return {
      items: sliced.map((player) => mapRosterRow(player)),
      nextCursor: hasMore ? (sliced[sliced.length - 1]?.id ?? null) : null,
    };
  });
}

/**
 * Lists teams for roster assignment UX including unassigned player count.
 */
export async function listAdminRosterTeams(eventId: string): Promise<ListAdminRosterTeamsResponse> {
  return withTraceSpan('admin.roster.teams.list', { eventId }, async () => {
    const [teams, unassignedCount] = await Promise.all([
      prisma.team.findMany({
        where: {
          eventId,
          deletedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          status: true,
          _count: {
            select: {
              players: true,
            },
          },
        },
      }),
      prisma.player.count({
        where: {
          eventId,
          teamId: null,
        },
      }),
    ]);

    return {
      teams: teams.map((team) => ({
        teamId: team.id,
        teamName: team.name,
        teamStatus: team.status,
        memberCount: team._count.players,
      })),
      unassignedCount,
    };
  });
}

/**
 * Reassigns (or unassigns) a player's team membership and records an audit row.
 */
export async function updateRosterAssignment(
  eventId: string,
  playerId: string,
  request: UpdateRosterAssignmentRequest,
  context: AdminActionContext = {}
): Promise<UpdateRosterAssignmentResponse> {
  return withTraceSpan('admin.roster.assignment.update', { eventId, playerId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorUserId = await resolveActorUserId(tx, context.actorUserId);

      const player = await tx.player.findFirst({
        where: {
          id: playerId,
          eventId,
        },
        select: {
          id: true,
          eventId: true,
          teamId: true,
          updatedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (!player) {
        throw new ValidationError('Player does not exist for this event.', {
          eventId,
          playerId,
        });
      }

      let targetTeam: {
        id: string;
        name: string;
        status: 'PENDING' | 'ACTIVE' | 'IN_PIT';
      } | null = null;

      if (request.teamId) {
        targetTeam = await tx.team.findFirst({
          where: {
            id: request.teamId,
            eventId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
        });

        if (!targetTeam) {
          throw new ValidationError('Team does not exist for this event.', {
            eventId,
            teamId: request.teamId,
          });
        }
      }

      const previousTeamId = player.team?.id ?? null;
      const previousTeamName = player.team?.name ?? null;
      const previousTeamStatus = player.team?.status ?? null;
      const nextTeamId = targetTeam?.id ?? null;

      if (previousTeamId === nextTeamId) {
        return {
          playerId: player.id,
          eventId: player.eventId,
          previousTeamId,
          previousTeamName,
          previousTeamStatus,
          teamId: previousTeamId,
          teamName: previousTeamName,
          teamStatus: previousTeamStatus,
          assignmentStatus: resolveAssignmentStatus(player.team),
          updatedAt: player.updatedAt.toISOString(),
          auditId: null,
        };
      }

      const updatedPlayer = await tx.player.update({
        where: {
          id: player.id,
        },
        data: {
          teamId: nextTeamId,
          status: resolvePlayerStatusFromTeamStatus(targetTeam?.status ?? null),
        },
        select: {
          id: true,
          eventId: true,
          updatedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      const actionType =
        previousTeamId === null && nextTeamId !== null
          ? 'ROSTER_ASSIGNED'
          : previousTeamId !== null && nextTeamId === null
            ? 'ROSTER_UNASSIGNED'
            : 'ROSTER_REASSIGNED';

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId,
          actionType,
          targetType: 'PLAYER',
          targetId: updatedPlayer.id,
          details: {
            previousTeamId,
            previousTeamName,
            nextTeamId,
            nextTeamName: updatedPlayer.team?.name ?? null,
            reason: request.reason,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        playerId: updatedPlayer.id,
        eventId: updatedPlayer.eventId,
        previousTeamId,
        previousTeamName,
        previousTeamStatus,
        teamId: updatedPlayer.team?.id ?? null,
        teamName: updatedPlayer.team?.name ?? null,
        teamStatus: updatedPlayer.team?.status ?? null,
        assignmentStatus: resolveAssignmentStatus(updatedPlayer.team),
        updatedAt: updatedPlayer.updatedAt.toISOString(),
        auditId: audit.id,
      };
    });
  });
}

/**
 * Aggregates row-level import actions for preview/apply summaries.
 */
function summarizePreviewRows(rows: readonly ResolvedImportRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.errors.length > 0 || row.action === 'invalid') {
        summary.invalid += 1;
        return summary;
      }

      summary.valid += 1;
      summary[row.action] += 1;
      return summary;
    },
    {
      total: 0,
      valid: 0,
      invalid: 0,
      create: 0,
      update: 0,
      assign: 0,
      reassign: 0,
      unchanged: 0,
    }
  );
}

function toPreviewResponse(rows: readonly ResolvedImportRow[]): RosterImportPreviewResponse {
  const mappedRows: RosterImportPreviewRow[] = rows.map((row) => ({
    rowNumber: row.rowNumber,
    workEmail: row.workEmail,
    normalizedWorkEmail: row.normalizedWorkEmail,
    displayName: row.displayName,
    phoneE164: row.phoneE164,
    teamName: row.teamName,
    action: row.errors.length > 0 ? 'invalid' : row.action,
    isValid: row.errors.length === 0,
    errors: row.errors,
  }));

  return {
    rows: mappedRows,
    summary: summarizePreviewRows(rows),
  };
}

/**
 * Resolves import rows into validated, action-ready records by comparing payload
 * values against existing users, players, and teams.
 */
async function resolvePreviewRows(
  eventId: string,
  request: RosterImportPreviewRequest
): Promise<ResolvedImportRow[]> {
  const normalizedRows = request.rows.map((row, index) => {
    const errors: string[] = [];
    const normalizedWorkEmail = normalizeWorkEmail(row.workEmail);
    const displayName = row.displayName.trim();
    const phoneE164 = normalizeOptionalPhone(row.phoneE164 ?? null);
    const teamName = normalizeOptionalName(row.teamName ?? null);

    if (!normalizedWorkEmail) {
      errors.push('Work email is required.');
    }

    if (!displayName) {
      errors.push('Display name is required.');
    }

    if (phoneE164 && !PHONE_E164_REGEX.test(phoneE164)) {
      errors.push('Phone number must be in E.164 format.');
    }

    return {
      rowNumber: index + 1,
      workEmail: row.workEmail,
      normalizedWorkEmail,
      displayName,
      phoneE164,
      teamName,
      action: 'unchanged' as RosterImportAction,
      errors,
      existingUserId: null,
      existingPlayerId: null,
      existingTeamId: null,
      targetTeamNameNormalized: teamName ? normalizeTeamKey(teamName) : null,
    };
  });

  const emailCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    const currentCount = emailCounts.get(row.normalizedWorkEmail) ?? 0;
    emailCounts.set(row.normalizedWorkEmail, currentCount + 1);
  }

  const workEmails = Array.from(emailCounts.keys());
  const teamNames = Array.from(
    new Set(
      normalizedRows
        .map((row) => row.teamName)
        .filter((teamName): teamName is string => Boolean(teamName))
    )
  );

  const [existingUsers, existingPlayers, existingTeams] = await Promise.all([
    prisma.user.findMany({
      where: {
        email: {
          in: workEmails,
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        phoneE164: true,
      },
    }),
    prisma.player.findMany({
      where: {
        eventId,
        user: {
          email: {
            in: workEmails,
          },
        },
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
        user: {
          select: {
            email: true,
            displayName: true,
            phoneE164: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    }),
    prisma.team.findMany({
      where: {
        eventId,
        deletedAt: null,
        name: {
          in: teamNames,
        },
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const usersByEmail = new Map(existingUsers.map((user) => [normalizeWorkEmail(user.email), user]));
  const playersByEmail = new Map(
    existingPlayers.map((player) => [normalizeWorkEmail(player.user.email), player])
  );
  const teamsByNormalizedName = new Map(
    existingTeams.map((team) => [normalizeTeamKey(team.name), team])
  );

  return normalizedRows.map((row) => {
    const errors = [...row.errors];
    const duplicateCount = emailCounts.get(row.normalizedWorkEmail) ?? 0;
    if (duplicateCount > 1) {
      errors.push('Duplicate workEmail in import payload.');
    }

    const existingUser = usersByEmail.get(row.normalizedWorkEmail) ?? null;
    const existingPlayer = playersByEmail.get(row.normalizedWorkEmail) ?? null;

    let action: RosterImportAction = 'unchanged';

    if (errors.length > 0) {
      action = 'invalid';
    } else if (!existingPlayer) {
      action = 'create';
    } else {
      const hasUserChange =
        existingPlayer.user.displayName !== row.displayName ||
        (existingPlayer.user.phoneE164 ?? null) !== row.phoneE164;

      if (row.targetTeamNameNormalized && row.teamName) {
        const targetTeam = teamsByNormalizedName.get(row.targetTeamNameNormalized) ?? null;
        if (existingPlayer.teamId === null) {
          action = 'assign';
        } else if (targetTeam && existingPlayer.teamId !== targetTeam.id) {
          action = 'reassign';
        } else if (!targetTeam && existingPlayer.team?.name !== row.teamName) {
          action = 'reassign';
        } else if (hasUserChange) {
          action = 'update';
        } else {
          action = 'unchanged';
        }
      } else if (hasUserChange) {
        action = 'update';
      }
    }

    return {
      ...row,
      action,
      errors,
      existingUserId: existingUser?.id ?? null,
      existingPlayerId: existingPlayer?.id ?? null,
      existingTeamId: existingPlayer?.teamId ?? null,
    };
  });
}

/**
 * Returns normalized preview output and action summary for roster imports.
 */
export async function previewRosterImport(
  eventId: string,
  request: RosterImportPreviewRequest
): Promise<RosterImportPreviewResponse> {
  return withTraceSpan('admin.roster.import.preview', { eventId }, async () => {
    const resolvedRows = await resolvePreviewRows(eventId, request);
    return toPreviewResponse(resolvedRows);
  });
}

/**
 * Applies roster imports transactionally and records aggregate import audit data.
 */
export async function applyRosterImport(
  eventId: string,
  request: RosterImportApplyRequest,
  context: AdminActionContext = {}
): Promise<RosterImportApplyResponse> {
  return withTraceSpan('admin.roster.import.apply', { eventId }, async () => {
    const resolvedRows = await resolvePreviewRows(eventId, request);

    return prisma.$transaction(async (tx) => {
      const actorUserId = await resolveActorUserId(tx, context.actorUserId);

      const event = await tx.event.findUnique({
        where: {
          id: eventId,
        },
        select: {
          id: true,
        },
      });

      if (!event) {
        throw new ValidationError('Event does not exist.', { eventId });
      }

      const existingTeams = await tx.team.findMany({
        where: {
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

      const teamsByNormalizedName = new Map(
        existingTeams.map((team) => [normalizeTeamKey(team.name), team])
      );

      let createdUsers = 0;
      let updatedUsers = 0;
      let createdPlayers = 0;
      let assigned = 0;
      let reassigned = 0;
      let unchanged = 0;
      let createdTeams = 0;
      let processed = 0;

      for (const row of resolvedRows) {
        if (row.errors.length > 0 || row.action === 'invalid') {
          continue;
        }

        processed += 1;

        let targetTeam: {
          id: string;
          name: string;
          status: 'PENDING' | 'ACTIVE' | 'IN_PIT';
        } | null = null;

        if (row.targetTeamNameNormalized && row.teamName) {
          const existingTeam = teamsByNormalizedName.get(row.targetTeamNameNormalized);
          if (existingTeam) {
            targetTeam = existingTeam;
          } else {
            const createdTeam = await tx.team.create({
              data: {
                eventId,
                name: row.teamName,
              },
              select: {
                id: true,
                name: true,
                status: true,
              },
            });

            teamsByNormalizedName.set(row.targetTeamNameNormalized, createdTeam);
            targetTeam = createdTeam;
            createdTeams += 1;
          }
        }

        const existingUser = row.existingUserId
          ? await tx.user.findUnique({
              where: {
                id: row.existingUserId,
              },
              select: {
                id: true,
                displayName: true,
                phoneE164: true,
              },
            })
          : null;

        const user = await tx.user.upsert({
          where: {
            email: row.normalizedWorkEmail,
          },
          create: {
            email: row.normalizedWorkEmail,
            displayName: row.displayName,
            phoneE164: row.phoneE164,
            role: 'PLAYER',
            isHelios: false,
          },
          update: {
            displayName: row.displayName,
            phoneE164: row.phoneE164,
          },
          select: {
            id: true,
          },
        });

        if (!existingUser) {
          createdUsers += 1;
        } else if (
          existingUser.displayName !== row.displayName ||
          (existingUser.phoneE164 ?? null) !== row.phoneE164
        ) {
          updatedUsers += 1;
        }

        const existingPlayer = await tx.player.findFirst({
          where: {
            eventId,
            userId: user.id,
          },
          select: {
            id: true,
            teamId: true,
          },
        });

        if (!existingPlayer) {
          await tx.player.create({
            data: {
              userId: user.id,
              eventId,
              teamId: targetTeam?.id ?? null,
              status: resolvePlayerStatusFromTeamStatus(targetTeam?.status ?? null),
            },
          });

          createdPlayers += 1;
          if (targetTeam) {
            assigned += 1;
            await tx.adminActionAudit.create({
              data: {
                eventId,
                actorUserId,
                actionType: 'ROSTER_ASSIGNED',
                targetType: 'USER',
                targetId: user.id,
                details: {
                  source: 'import',
                  previousTeamId: null,
                  nextTeamId: targetTeam.id,
                },
              },
            });
          }
          continue;
        }

        if (!row.targetTeamNameNormalized) {
          unchanged += 1;
          continue;
        }

        const nextTeamId = targetTeam?.id ?? null;
        if (existingPlayer.teamId === nextTeamId) {
          unchanged += 1;
          continue;
        }

        await tx.player.update({
          where: {
            id: existingPlayer.id,
          },
          data: {
            teamId: nextTeamId,
            status: resolvePlayerStatusFromTeamStatus(targetTeam?.status ?? null),
          },
        });

        if (existingPlayer.teamId === null && nextTeamId !== null) {
          assigned += 1;
        } else {
          reassigned += 1;
        }

        await tx.adminActionAudit.create({
          data: {
            eventId,
            actorUserId,
            actionType:
              existingPlayer.teamId === null && nextTeamId !== null
                ? 'ROSTER_ASSIGNED'
                : nextTeamId === null
                  ? 'ROSTER_UNASSIGNED'
                  : 'ROSTER_REASSIGNED',
            targetType: 'PLAYER',
            targetId: existingPlayer.id,
            details: {
              source: 'import',
              previousTeamId: existingPlayer.teamId,
              nextTeamId,
            },
          },
        });
      }

      const previewSummary = summarizePreviewRows(resolvedRows);
      const importAudit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId,
          actionType: 'ROSTER_IMPORTED',
          targetType: 'ROSTER_IMPORT',
          details: {
            previewSummary,
            processed,
            createdUsers,
            updatedUsers,
            createdPlayers,
            assigned,
            reassigned,
            unchanged,
            createdTeams,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        rows: toPreviewResponse(resolvedRows).rows,
        summary: {
          total: resolvedRows.length,
          processed,
          invalid: previewSummary.invalid,
          createdUsers,
          updatedUsers,
          createdPlayers,
          assigned,
          reassigned,
          unchanged,
          createdTeams,
        },
        auditId: importAudit.id,
      };
    });
  });
}

/**
 * Returns a full admin team-detail snapshot (rank, score, pit status, and member roster).
 */
export async function getAdminTeamDetail(
  eventId: string,
  teamId: string
): Promise<GetAdminTeamDetailResponse> {
  return withTraceSpan('admin.team.detail.get', { eventId, teamId }, async () => {
    const [team, rankedTeams] = await Promise.all([
      prisma.team.findFirst({
        where: {
          id: teamId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventId: true,
          name: true,
          score: true,
          status: true,
          pitStopExpiresAt: true,
          players: {
            orderBy: [
              {
                individualScore: 'desc',
              },
              {
                user: {
                  displayName: 'asc',
                },
              },
              {
                id: 'asc',
              },
            ],
            select: {
              id: true,
              userId: true,
              individualScore: true,
              joinedAt: true,
              user: {
                select: {
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.team.findMany({
        where: {
          eventId,
          deletedAt: null,
        },
        orderBy: [
          {
            score: 'desc',
          },
          {
            name: 'asc',
          },
          {
            id: 'asc',
          },
        ],
        select: {
          id: true,
        },
      }),
    ]);

    if (!team) {
      throw new ValidationError('Team does not exist for this event.', { eventId, teamId });
    }

    const members = team.players.map((member, index) => ({
      playerId: member.id,
      userId: member.userId,
      displayName: member.user.displayName,
      workEmail: member.user.email,
      individualScore: member.individualScore,
      joinedAt: member.joinedAt.toISOString(),
      rank: index + 1,
    }));

    return {
      eventId: team.eventId,
      teamId: team.id,
      teamName: team.name,
      teamStatus: team.status,
      score: team.score,
      rank: findRankById(rankedTeams, team.id) ?? rankedTeams.length + 1,
      pitStopExpiresAt: team.pitStopExpiresAt?.toISOString() ?? null,
      keywords: [],
      memberCount: members.length,
      members,
    };
  });
}

/**
 * Updates an admin-managed team score override and writes an audit entry.
 */
export async function updateAdminTeamScore(
  eventId: string,
  teamId: string,
  request: UpdateAdminTeamScoreRequest,
  context: AdminActionContext = {}
): Promise<UpdateAdminTeamScoreResponse> {
  return withTraceSpan('admin.team.score.update', { eventId, teamId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorUserId = await resolveActorUserId(tx, context.actorUserId);
      const existing = await tx.team.findFirst({
        where: {
          id: teamId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          score: true,
        },
      });

      if (!existing) {
        throw new ValidationError('Team does not exist for this event.', { eventId, teamId });
      }

      const updated = await tx.team.update({
        where: {
          id: existing.id,
        },
        data: {
          score: request.score,
        },
        select: {
          id: true,
          eventId: true,
          score: true,
          updatedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId,
          actionType: 'TEAM_SCORE_UPDATED',
          targetType: 'TEAM',
          targetId: updated.id,
          details: {
            previousScore: existing.score,
            nextScore: updated.score,
            reason: request.reason,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId: updated.eventId,
        teamId: updated.id,
        score: updated.score,
        updatedAt: updated.updatedAt.toISOString(),
        auditId: audit.id,
      };
    });
  });
}

/**
 * Soft-deletes a team, unassigns every member, and records an audit entry.
 */
export async function deleteAdminTeam(
  eventId: string,
  teamId: string,
  context: AdminActionContext = {}
): Promise<DeleteAdminTeamResponse> {
  return withTraceSpan('admin.team.delete', { eventId, teamId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorUserId = await resolveActorUserId(tx, context.actorUserId);
      const existing = await tx.team.findFirst({
        where: {
          id: teamId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!existing) {
        throw new ValidationError('Team does not exist for this event.', { eventId, teamId });
      }

      const unassignedMembers = await tx.player.updateMany({
        where: {
          eventId,
          teamId: existing.id,
        },
        data: {
          teamId: null,
          status: 'RACING',
        },
      });

      const deletedAt = new Date();
      await tx.team.update({
        where: {
          id: existing.id,
        },
        data: {
          deletedAt,
          pitStopExpiresAt: null,
          status: 'ACTIVE',
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId,
          actionType: 'TEAM_SOFT_DELETED',
          targetType: 'TEAM',
          targetId: existing.id,
          details: {
            teamName: existing.name,
            unassignedPlayerCount: unassignedMembers.count,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId,
        teamId: existing.id,
        deletedAt: deletedAt.toISOString(),
        unassignedPlayerCount: unassignedMembers.count,
        auditId: audit.id,
      };
    });
  });
}

/**
 * Returns player-level detail metrics for admin drill-down views.
 */
export async function getAdminPlayerDetail(
  eventId: string,
  playerId: string
): Promise<GetAdminPlayerDetailResponse> {
  return withTraceSpan('admin.player.detail.get', { eventId, playerId }, async () => {
    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        eventId,
      },
      select: {
        id: true,
        eventId: true,
        userId: true,
        joinedAt: true,
        individualScore: true,
        teamId: true,
        user: {
          select: {
            displayName: true,
            email: true,
            phoneE164: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            score: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!player) {
      throw new ValidationError('Player does not exist for this event.', { eventId, playerId });
    }

    const rankedPlayers = await prisma.player.findMany({
      where: {
        eventId,
      },
      orderBy: [
        {
          individualScore: 'desc',
        },
        {
          user: {
            displayName: 'asc',
          },
        },
        {
          id: 'asc',
        },
      ],
      select: {
        id: true,
      },
    });

    let teamId: string | null = null;
    let teamName: string | null = null;
    let teamScore: number | null = null;
    let teamRank: number | null = null;

    if (player.team && player.team.deletedAt === null) {
      const rankedTeamMembers = await prisma.player.findMany({
        where: {
          eventId,
          teamId: player.team.id,
        },
        orderBy: [
          {
            individualScore: 'desc',
          },
          {
            user: {
              displayName: 'asc',
            },
          },
          {
            id: 'asc',
          },
        ],
        select: {
          id: true,
        },
      });

      teamId = player.team.id;
      teamName = player.team.name;
      teamScore = player.team.score;
      teamRank = findRankById(rankedTeamMembers, player.id);
    }

    return {
      eventId: player.eventId,
      playerId: player.id,
      userId: player.userId,
      displayName: player.user.displayName,
      workEmail: player.user.email,
      phoneE164: player.user.phoneE164,
      joinedAt: player.joinedAt.toISOString(),
      individualScore: player.individualScore,
      globalRank: findRankById(rankedPlayers, player.id),
      teamId,
      teamName,
      teamScore,
      teamRank,
    };
  });
}

/**
 * Updates player contact details and records a dedicated admin audit event.
 */
export async function updateAdminPlayerContact(
  eventId: string,
  playerId: string,
  request: UpdateAdminPlayerContactRequest,
  context: AdminActionContext = {}
): Promise<UpdateAdminPlayerContactResponse> {
  return withTraceSpan('admin.player.contact.update', { eventId, playerId }, async () => {
    return prisma.$transaction(async (tx) => {
      const actorUserId = await resolveActorUserId(tx, context.actorUserId);
      const existing = await tx.player.findFirst({
        where: {
          id: playerId,
          eventId,
        },
        select: {
          id: true,
          eventId: true,
          userId: true,
          user: {
            select: {
              email: true,
              phoneE164: true,
            },
          },
        },
      });

      if (!existing) {
        throw new ValidationError('Player does not exist for this event.', { eventId, playerId });
      }

      const nextEmail = normalizeWorkEmail(request.workEmail);
      if (!nextEmail) {
        throw new ValidationError('workEmail must be a valid email address.', {
          workEmail: request.workEmail,
        });
      }

      const conflictingUser = await tx.user.findUnique({
        where: {
          email: nextEmail,
        },
        select: {
          id: true,
        },
      });

      if (conflictingUser && conflictingUser.id !== existing.userId) {
        throw new ValidationError('A user with this workEmail already exists.', {
          workEmail: nextEmail,
        });
      }

      const updatedUser = await tx.user.update({
        where: {
          id: existing.userId,
        },
        data: {
          email: nextEmail,
          phoneE164: request.phoneE164,
        },
        select: {
          id: true,
          email: true,
          phoneE164: true,
          updatedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId,
          actionType: 'PLAYER_CONTACT_UPDATED',
          targetType: 'PLAYER',
          targetId: existing.id,
          details: {
            previousWorkEmail: existing.user.email,
            nextWorkEmail: updatedUser.email,
            previousPhoneE164: existing.user.phoneE164,
            nextPhoneE164: updatedUser.phoneE164,
            reason: request.reason,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId: existing.eventId,
        playerId: existing.id,
        userId: updatedUser.id,
        workEmail: updatedUser.email,
        phoneE164: updatedUser.phoneE164,
        updatedAt: updatedUser.updatedAt.toISOString(),
        auditId: audit.id,
      };
    });
  });
}

/**
 * Returns cursor-paginated scan history for an admin-selected player.
 */
export async function listAdminPlayerScanHistory(
  eventId: string,
  playerId: string,
  query: ListAdminPlayerScanHistoryQuery
): Promise<ListAdminPlayerScanHistoryResponse> {
  return withTraceSpan('admin.player.scan_history.list', { eventId, playerId }, async () => {
    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        eventId,
      },
      select: {
        id: true,
      },
    });

    if (!player) {
      throw new ValidationError('Player does not exist for this event.', { eventId, playerId });
    }

    const limit = query.limit ?? 100;
    const scanRows = await prisma.scanRecord.findMany({
      where: {
        eventId,
        playerId,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      ...(query.cursor
        ? {
            cursor: {
              id: query.cursor,
            },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      select: {
        id: true,
        eventId: true,
        playerId: true,
        teamId: true,
        qrCodeId: true,
        scannedPayload: true,
        outcome: true,
        pointsAwarded: true,
        createdAt: true,
        message: true,
        qrCode: {
          select: {
            label: true,
          },
        },
      },
    });

    const hasMore = scanRows.length > limit;
    const sliced = hasMore ? scanRows.slice(0, limit) : scanRows;

    return {
      items: sliced.map((row) => mapScanHistoryRow(row)),
      nextCursor: hasMore ? (sliced[sliced.length - 1]?.id ?? null) : null,
    };
  });
}
