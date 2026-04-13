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
 *    1. Run text moderation (OpenAI or keyword fallback)
 *    2. Upsert the player's GarageSubmission row (one slot per player-team)
 *    3. Count APPROVED submissions for the team
 *    4. If count >= requiredPlayerCount, fire logo generation (idempotent via
 *       DB-level status guard so concurrent submits don't double-call n8n)
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
 *  submit at the same millisecond and both cross the quota, only one will win
 *  the status-flip and dispatch n8n.  The loser sees GENERATING already set
 *  and returns without a second call.
 */
import type {
  GarageSubmitRequest,
  GarageSubmitResponse,
  TeamGarageStatus,
} from '@velocity-gp/api-contract';

import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/appError.js';
import { generateTeamLogo } from './n8nService.js';
import { moderateText } from './moderationService.js';

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
  return buildTeamGarageStatus(teamId, playerId);
}

// ── Internal: quota check + generation trigger ────────────────────────────────

/**
 * Checks whether the team has reached its submission quota.
 * If so, attempts to atomically claim the GENERATING state and dispatches the
 * n8n logo generation call as a background task (fire-and-forget via setImmediate).
 * The submit response is returned to the client immediately; the UI polls /status
 * every ~4s and sees GENERATING → READY when the job completes.
 *
 * Idempotency:
 *   The `updateMany` only matches teams whose logoStatus is NOT already GENERATING.
 *   If two concurrent requests both cross the quota, only the one that successfully
 *   flips the status will proceed; the other finds count===0 and exits quietly.
 */
async function maybeEnqueueLogoGeneration(teamId: string): Promise<void> {
  // Fetch team and count APPROVED submissions in one round-trip
  const [team, approvedCount] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        requiredPlayerCount: true,
        logoStatus: true,
      },
    }),
    prisma.garageSubmission.count({
      where: { teamId, status: 'APPROVED' },
    }),
  ]);

  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', `Team ${teamId} does not exist`);
  }

  // Env override wins over per-team DB value — useful in dev (set to 1) so any
  // single-player submission triggers logo generation without needing teammates.
  const requiredCount = env.GARAGE_REQUIRED_PLAYER_COUNT ?? team.requiredPlayerCount;

  logger.debug('[garageService] maybeEnqueueLogoGeneration — quota check', {
    teamId,
    approvedCount,
    required: requiredCount,
    dbRequired: team.requiredPlayerCount,
    logoStatus: team.logoStatus,
  });

  // Has the quota been reached?
  if (approvedCount < requiredCount) {
    return; // Still waiting for more teammates
  }

  // If more members have submitted than originally required (a late joiner), we
  // allow re-generation even from the READY state so their description is included.
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

    // Log each description being incorporated so the prompt build is fully traceable
    descriptions.forEach((desc, i) => {
      logger.info('[garageService] Including member description in logo prompt', {
        teamId,
        teamName,
        memberIndex: i + 1,
        total: descriptions.length,
        playerId: submissions[i].playerId,
        description: desc,
      });
    });

    // Build a structured prompt the image model can act on directly
    const prompt = buildLogoPrompt(teamName, descriptions);

    logger.info('[garageService] Final logo prompt constructed — dispatching to n8n', {
      teamId,
      teamName,
      descriptionCount: descriptions.length,
      prompt,
    });

    // generateTeamLogo calls the n8n webhook which runs an OpenAI image
    // generation step, uploads the image to storage, and returns the URL.
    // See n8nService.ts for the implementation.
    const logoUrl = await generateTeamLogo({
      prompt,
      teamName,
    });

    // Persist the result — the UI's next poll will see logoStatus: 'READY'
    await prisma.team.update({
      where: { id: teamId },
      data: {
        logoUrl,
        logoStatus: 'READY',
        logoGeneratedAt: new Date(),
      },
    });

    logger.info('[garageService] Logo generated and stored', { teamId, logoUrl });
  } catch (error) {
    // Mark as FAILED so the next approved submission can retry
    await prisma.team.update({
      where: { id: teamId },
      data: { logoStatus: 'FAILED' },
    });

    const message = error instanceof Error ? error.message : String(error);
    logger.error('[garageService] Logo generation failed', { teamId, message });
    // Do NOT re-throw — triggerLogoGeneration is called fire-and-forget via setImmediate.
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

  return memberTraits;
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
        requiredPlayerCount: true,
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
    // Env override wins so the UI progress bar reflects the same threshold
    // used by the generation logic at runtime.
    requiredCount: env.GARAGE_REQUIRED_PLAYER_COUNT ?? team.requiredPlayerCount,
    mySubmission: {
      submitted: mySubmission !== null,
      status: mySubmission
        ? (mySubmission.status as TeamGarageStatus['mySubmission']['status'])
        : null,
    },
  };
}
