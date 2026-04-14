/**
 * Garage Service
 *
 * Core business logic for the Garage workflow.  This module is the only place
 * that talks to the database for garage operations — routes and other services
 * call into here rather than querying Prisma directly.
 *
 * ── Key responsibilities ─────────────────────────────────────────────────────
 *
 *  submitDescription()
 *    1. Run text moderation (n8n webhook or keyword fallback)
 *    2. Upsert the player's GarageSubmission row (one slot per player-team)
 *    3. Count APPROVED submissions for the team
 *    4. If every currently-joined player has an APPROVED submission, fire logo
 *       generation (idempotent via DB-level status guard so concurrent submits
 *       don't double-call n8n)
 *    5. Return the submit outcome plus current team status snapshot
 *
 *  getTeamGarageStatus()
 *    Pure read — returns the same TeamGarageStatus shape that submitDescription
 *    returns, used by the UI polling loop.
 *
 *  triggerLogoGeneration()  (internal)
 *    Collects all APPROVED descriptions in submission order, builds a combined
 *    prompt, calls n8nService.generateTeamLogo(), and persists the result.
 *    Always re-generates (even if a logo already exists) so late-joining
 *    teammates' descriptions are included in the latest version.
 *
 * ── Concurrency safety ────────────────────────────────────────────────────────
 *
 *  The GENERATING guard uses a conditional `updateMany` (only matches when
 *  logoStatus is NOT already GENERATING) inside a transaction.  If two players
 *  submit at the same millisecond and both complete the roster, only one will win
 *  the status-flip and dispatch n8n.  The loser sees GENERATING already set
 *  and returns without a second call.
 */
import type {
  GarageSubmitRequest,
  GarageSubmitResponse,
  TeamGarageStatus,
} from '@velocity-gp/api-contract';

import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { AppError, DependencyError, ForbiddenError, NotFoundError } from '../utils/appError.js';
import { generateTeamLogo } from './n8nService.js';
import { moderateText } from './moderationService.js';

// ── Logo polling constants ────────────────────────────────────────────────────

/** How long to wait after firing n8n before the first DB check. */
const LOGO_POLL_INITIAL_DELAY_MS = 30_000;
/** Interval between successive DB checks. */
const LOGO_POLL_INTERVAL_MS = 5_000;
/** Maximum number of DB checks before giving up (~5 minutes total after initial delay). */
const LOGO_POLL_MAX_ATTEMPTS = 60;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ── Public: admin-triggered logo regeneration ────────────────────────────────

/**
 * Admin-facing logo regeneration.  Collects all APPROVED descriptions for the
 * team (regardless of quota) and fires logo generation immediately.
 *
 * Unlike maybeEnqueueLogoGeneration() this does NOT check the quota — the admin
 * is explicitly requesting a regeneration with whatever descriptions exist.
 * If no APPROVED descriptions exist the call throws so the UI can surface a
 * clear message.
 *
 * The generation runs in the background (fire-and-forget) to keep the HTTP
 * response fast.  The UI can poll /garage/status or the admin team-detail
 * endpoint to observe logoStatus: GENERATING → READY.
 */
export async function adminTriggerLogoGeneration(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, logoStatus: true },
  });

  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', `Team ${teamId} does not exist`);
  }

  const approvedCount = await prisma.garageSubmission.count({
    where: { teamId, status: 'APPROVED' },
  });

  if (approvedCount === 0) {
    throw new AppError(
      409,
      'NO_APPROVED_DESCRIPTIONS',
      'No approved descriptions exist for this team. At least one player must submit before a logo can be generated.'
    );
  }

  // Atomic claim — skip if already generating
  const { count: claimed } = await prisma.team.updateMany({
    where: {
      id: teamId,
      logoStatus: { notIn: ['GENERATING'] },
    },
    data: { logoStatus: 'GENERATING' },
  });

  if (claimed === 0) {
    throw new AppError(
      409,
      'LOGO_ALREADY_GENERATING',
      'Logo generation is already in progress for this team.'
    );
  }

  logger.info('[garageService] Admin triggered logo regeneration', { teamId });

  setTimeout(() => {
    void triggerLogoGeneration(teamId, team.name);
  }, 0);
}

// ── Public: submit a description ─────────────────────────────────────────────

/**
 * Handles a player submitting their self-description.
 *
 * Returns HTTP-200 for both approved and rejected outcomes so the UI can
 * render policy messages without triggering error-boundary components.
 *
 * Throws AppError (→ 4xx/5xx) only for infrastructure problems or bad input
 * that slipped past Zod validation (belt-and-suspenders guard).
 */
export async function submitDescription(
  request: GarageSubmitRequest
): Promise<GarageSubmitResponse> {
  const { playerId, teamId, eventId, description } = request;

  await assertSubmissionContext({ playerId, teamId, eventId });

  logger.info('[garageService] submitDescription — starting moderation', { playerId, teamId });

  // ── Step 1: Moderate the description ──────────────────────────────────────
  // moderateText throws only on infrastructure failure; content rejections are
  // returned as data (safe: false) so we can give the user a helpful message.
  const moderation = await moderateText(description);

  if (!moderation.safe) {
    logger.info('[garageService] Description rejected by moderation', {
      playerId,
      teamId,
      flaggedCategory: moderation.flaggedCategory,
    });

    // Upsert a REJECTED row so the admin audit trail captures the attempt,
    // but mark moderatedAt so we know it was settled (not just PENDING).
    await prisma.garageSubmission.upsert({
      where: { playerId_teamId: { playerId, teamId } },
      create: {
        playerId,
        teamId,
        eventId,
        description,
        status: 'REJECTED',
        moderatedAt: new Date(),
      },
      update: {
        description,
        status: 'REJECTED',
        moderatedAt: new Date(),
      },
    });

    // Still return team status so the UI can show where the team stands
    const teamGarageStatus = await buildTeamGarageStatus(teamId, playerId);

    return {
      status: 'rejected',
      policyMessage: moderation.policyMessage,
      teamGarageStatus,
    };
  }

  // ── Step 2: Persist the approved description ───────────────────────────────
  // Upsert guarantees exactly one row per (player, team).  If the player is
  // retrying after a previous rejection, this overwrites the old row.
  await prisma.garageSubmission.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    create: {
      playerId,
      teamId,
      eventId,
      description,
      status: 'APPROVED',
      moderatedAt: new Date(),
    },
    update: {
      description,
      status: 'APPROVED',
      moderatedAt: new Date(),
    },
  });

  logger.info('[garageService] Description approved and stored', { playerId, teamId });

  // ── Step 3: Check quota and maybe trigger logo generation ─────────────────
  await maybeEnqueueLogoGeneration(teamId);

  // ── Step 4: Build and return the current team status snapshot ─────────────
  const teamGarageStatus = await buildTeamGarageStatus(teamId, playerId);

  return { status: 'approved', teamGarageStatus };
}

// ── Public: poll current team status ─────────────────────────────────────────

/**
 * Returns the current garage state for a team.
 * Called by the UI every 4 seconds while waiting for teammates or logo generation.
 * This is a pure read — no side effects.
 */
export async function getTeamGarageStatus(
  teamId: string,
  playerId: string
): Promise<TeamGarageStatus> {
  await assertPlayerCanAccessTeam({ teamId, playerId });
  return buildTeamGarageStatus(teamId, playerId);
}

// ── Internal: roster check + generation trigger ──────────────────────────────

/**
 * Checks whether every currently-joined player on the team has an APPROVED
 * submission. If so, attempts to atomically claim the GENERATING state and
 * dispatches the n8n logo generation call as a background task (fire-and-forget
 * via setTimeout(0)). The submit response is returned to the client immediately;
 * the UI polls /status every ~4s and sees GENERATING → READY when the job
 * completes.
 *
 * The threshold scales with the team's actual joined player count, so teams of
 * any size are supported without configuration.
 *
 * Idempotency:
 *   The `updateMany` only matches teams whose logoStatus is NOT already GENERATING.
 *   If two concurrent requests both complete the roster, only the one that
 *   successfully flips the status will proceed; the other finds count===0 and
 *   exits quietly.
 */
async function maybeEnqueueLogoGeneration(teamId: string): Promise<void> {
  // Fetch team, its actual player count, and count APPROVED submissions in one round-trip
  const [team, approvedCount] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        logoStatus: true,
        _count: { select: { players: true } },
      },
    }),
    prisma.garageSubmission.count({
      where: { teamId, status: 'APPROVED' },
    }),
  ]);

  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', `Team ${teamId} does not exist`);
  }

  // Logo generates when every currently-joined player on the team has an
  // APPROVED submission. The threshold is always the actual joined-player
  // count, so teams of any size work without configuration.
  const requiredCount = team._count.players;

  logger.debug('[garageService] maybeEnqueueLogoGeneration — roster check', {
    teamId,
    approvedCount,
    required: requiredCount,
    logoStatus: team.logoStatus,
  });

  // Has every player submitted?
  if (approvedCount < requiredCount) {
    return; // Still waiting for more teammates
  }

  // Allow re-generation if a late joiner's description wasn't yet included in
  // the current READY logo (approvedCount now exceeds the required threshold).
  const isLateJoiner = approvedCount > requiredCount && team.logoStatus === 'READY';
  const eligibleStatuses = isLateJoiner
    ? (['PENDING', 'FAILED', 'READY'] as const)
    : (['PENDING', 'FAILED'] as const);

  if (isLateJoiner) {
    logger.info(
      '[garageService] Late joiner detected — re-triggering logo generation to include new description',
      {
        teamId,
        approvedCount,
        required: requiredCount,
      }
    );
  }

  // ── Atomic status-flip: claim GENERATING ──────────────────────────────────
  // `updateMany` with the eligible-statuses filter is the concurrency guard.
  // Returned `count` tells us if we won the race.
  const { count: claimed } = await prisma.team.updateMany({
    where: {
      id: teamId,
      logoStatus: { in: [...eligibleStatuses] },
    },
    data: { logoStatus: 'GENERATING' },
  });

  if (claimed === 0) {
    // Another request already claimed the lock, or logo is already READY
    logger.debug('[garageService] Logo generation already claimed/running — skipping', { teamId });
    return;
  }

  logger.info('[garageService] Quota reached — starting logo generation', { teamId });

  // ── Dispatch logo generation as a background task ─────────────────────────
  // Fire-and-forget: claim GENERATING synchronously above (atomic), then let
  // the n8n call happen in the background.  This means:
  //   • The submit response always returns fast (no n8n latency exposed to user)
  //   • The UI polls /status every ~4s and sees GENERATING → READY when done
  //   • If n8n fails, the status is set to FAILED and the next submission retries
  setTimeout(() => {
    void triggerLogoGeneration(teamId, team.name);
  }, 0);
}

// ── Internal: n8n logo generation ────────────────────────────────────────────

/**
 * Collects all APPROVED descriptions for the team (oldest first so the prompt
 * is deterministic), builds a combined prompt, calls n8n, and persists the result.
 *
 * Always regenerates even if a logo already exists.  This is intentional:
 * when a new teammate joins and submits after the initial generation, the logo
 * should be updated to include their description too.
 */
async function triggerLogoGeneration(teamId: string, teamName: string): Promise<void> {
  try {
    // Collect APPROVED descriptions in submission order, including playerId for audit logs
    const submissions = await prisma.garageSubmission.findMany({
      where: { teamId, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { playerId: true, description: true },
    });

    const descriptions = submissions.map((s) => s.description.trim());

    // Build a structured prompt the image model can act on directly
    const prompt = buildLogoPrompt(teamName, descriptions);

    logger.info('[garageService] Final logo prompt constructed — dispatching to n8n', {
      teamId,
      descriptionCount: descriptions.length,
      promptLength: prompt.length,
    });

    // Fire the n8n webhook. The workflow generates the image, uploads it to
    // storage, and writes the resulting URL directly to the DB.
    // We do not read a URL from the response — instead we poll the DB below.
    await generateTeamLogo({ prompt, teamName });

    // Wait before the first check — n8n needs time to generate and upload the image.
    logger.info('[garageService] n8n webhook fired — waiting before polling DB for logoUrl', {
      teamId,
      initialDelayMs: LOGO_POLL_INITIAL_DELAY_MS,
    });
    await sleep(LOGO_POLL_INITIAL_DELAY_MS);

    // Poll the DB until n8n writes the logoUrl or we exhaust attempts.
    for (let attempt = 1; attempt <= LOGO_POLL_MAX_ATTEMPTS; attempt++) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { logoUrl: true },
      });

      if (team?.logoUrl) {
        // n8n has written the URL — mark the team READY
        await prisma.team.update({
          where: { id: teamId },
          data: { logoStatus: 'READY', logoGeneratedAt: new Date() },
        });

        logger.info('[garageService] Logo URL found in DB — marked READY', {
          teamId,
          logoUrl: team.logoUrl,
          attempt,
        });
        return;
      }

      logger.debug('[garageService] logoUrl not yet set — retrying', {
        teamId,
        attempt,
        maxAttempts: LOGO_POLL_MAX_ATTEMPTS,
      });

      await sleep(LOGO_POLL_INTERVAL_MS);
    }

    throw new DependencyError(
      `Logo URL was not written to the DB after ${LOGO_POLL_MAX_ATTEMPTS} attempts (~${Math.round((LOGO_POLL_INITIAL_DELAY_MS + LOGO_POLL_MAX_ATTEMPTS * LOGO_POLL_INTERVAL_MS) / 60_000)} min). n8n may have failed silently.`
    );
  } catch (error) {
    // Mark as FAILED so the next approved submission can retry
    await prisma.team.update({
      where: { id: teamId },
      data: { logoStatus: 'FAILED' },
    });

    const message = error instanceof Error ? error.message : String(error);
    logger.error('[garageService] Logo generation failed', { teamId, message });
    // Do NOT re-throw — triggerLogoGeneration is called fire-and-forget via setTimeout(0).
    // Re-throwing would create an unhandled rejection that crashes the process.
    // The UI polls /status and will see FAILED, allowing the next submission to retry.
  }
}

// ── Internal: prompt builder ────────────────────────────────────────────────

/**
 * Assembles the DALL-E image generation prompt from the team name and each
 * member's approved self-description.  Descriptions are indexed so the model
 * treats them as distinct contributor traits rather than one run-on phrase.
 *
 * Keep prompt changes here rather than in n8nService so all log output and
 * future prompt versioning/A–B testing stays in the business-logic layer.
 */
function buildLogoPrompt(teamName: string, descriptions: string[]): string {
  const memberTraits = descriptions.map((d, i) => `member ${i + 1}: ${d}`).join('\n');

  return [
    `Team name: ${teamName}`,
    'Create a racing team logo that reflects these member traits:',
    memberTraits,
  ].join('\n');
}

async function assertSubmissionContext(input: {
  playerId: string;
  teamId: string;
  eventId: string;
}): Promise<void> {
  const [player, team] = await Promise.all([
    prisma.player.findUnique({
      where: { id: input.playerId },
      select: { id: true, eventId: true, teamId: true },
    }),
    prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true, eventId: true },
    }),
  ]);

  if (!player) {
    throw new NotFoundError(`Player ${input.playerId} does not exist`, {
      playerId: input.playerId,
    });
  }

  if (!team) {
    throw new NotFoundError(`Team ${input.teamId} does not exist`, { teamId: input.teamId });
  }

  if (player.eventId !== input.eventId || team.eventId !== input.eventId) {
    throw new ForbiddenError('Player/team/event context mismatch', {
      playerId: input.playerId,
      teamId: input.teamId,
      eventId: input.eventId,
      playerEventId: player.eventId,
      teamEventId: team.eventId,
    });
  }

  if (player.teamId !== input.teamId) {
    throw new ForbiddenError('Player is not assigned to the requested team', {
      playerId: input.playerId,
      requestedTeamId: input.teamId,
      assignedTeamId: player.teamId,
    });
  }
}

async function assertPlayerCanAccessTeam(input: {
  teamId: string;
  playerId: string;
}): Promise<void> {
  const [player, team] = await Promise.all([
    prisma.player.findUnique({
      where: { id: input.playerId },
      select: { id: true, eventId: true, teamId: true },
    }),
    prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true, eventId: true },
    }),
  ]);

  if (!player) {
    throw new NotFoundError(`Player ${input.playerId} does not exist`, {
      playerId: input.playerId,
    });
  }

  if (!team) {
    throw new NotFoundError(`Team ${input.teamId} does not exist`, { teamId: input.teamId });
  }

  if (player.teamId !== input.teamId || player.eventId !== team.eventId) {
    throw new ForbiddenError('Player cannot access the requested team status', {
      playerId: input.playerId,
      requestedTeamId: input.teamId,
      assignedTeamId: player.teamId,
      playerEventId: player.eventId,
      teamEventId: team.eventId,
    });
  }
}

// ── Internal: status snapshot builder ────────────────────────────────────────

/**
 * Builds the TeamGarageStatus object returned in both submit responses and
 * status poll responses.  Fetches team metadata and player-specific submission
 * in two parallel queries.
 */
async function buildTeamGarageStatus(teamId: string, playerId: string): Promise<TeamGarageStatus> {
  // Fetch team info + count APPROVED rows in parallel
  const [team, approvedCount, mySubmission] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        logoStatus: true,
        // Count total assigned players without loading full records
        _count: { select: { players: true } },
      },
    }),
    prisma.garageSubmission.count({
      where: { teamId, status: 'APPROVED' },
    }),
    // The calling player's own submission state
    prisma.garageSubmission.findUnique({
      where: { playerId_teamId: { playerId, teamId } },
      select: { status: true },
    }),
  ]);

  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', `Team ${teamId} does not exist`);
  }

  return {
    teamId: team.id,
    teamName: team.name,
    logoUrl: team.logoUrl,
    // Cast from Prisma enum string to contract union type
    logoStatus: team.logoStatus as TeamGarageStatus['logoStatus'],
    totalMembers: team._count.players,
    approvedCount,
    // Mirror the generation trigger: every joined player must submit before
    // the logo fires, so the UI progress bar uses the same threshold.
    requiredCount: team._count.players,
    mySubmission: {
      submitted: mySubmission !== null,
      status: mySubmission
        ? (mySubmission.status as TeamGarageStatus['mySubmission']['status'])
        : null,
    },
  };
}
