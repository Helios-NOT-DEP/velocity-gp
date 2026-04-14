import type {
  AuthCapabilities,
  PlayerAuthSession,
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  RoutingDecisionResponse,
  SessionResponse,
  VerifyMagicLinkRequest,
  VerifyMagicLinkResponse,
} from '@velocity-gp/api-contract';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import {
  createMagicLinkToken,
  createSessionToken,
  verifyMagicLinkToken,
  verifySessionToken,
} from './authTokens.js';
import { getEmailDispatcher } from './emailDispatchService.js';
import { logger } from '../lib/logger.js';
import { AUTH_SESSION_COOKIE_NAME, resolveSessionToken } from './authSessionToken.js';
import { recordOnboardingCompletedActivity } from './teamActivityFeedService.js';
import { normalizeWorkEmail } from '../utils/normalizeEmail.js';

/**
 * Authentication service for magic-link and session flows.
 *
 * This module derives routing decisions from team assignment state and enforces
 * capability-aware auth eligibility checks during magic-link requests.
 */
const GENERIC_MAGIC_LINK_MESSAGE =
  'If your work email is eligible for this event, you will receive a secure sign-in link shortly.';

export const AUTH_SESSION_COOKIE_MAX_AGE_MS = env.AUTH_SESSION_COOKIE_TTL_DAYS * 24 * 60 * 60_000;
export { AUTH_SESSION_COOKIE_NAME };

interface ActivePlayerContext {
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string | null;
  readonly teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null;
  readonly eventName: string;
}

interface AuthCandidate {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly capabilities: AuthCapabilities;
  readonly activePlayer: ActivePlayerContext | null;
}

/**
 * Builds the frontend callback URL that carries the signed magic-link token.
 */
function resolveFrontendMagicLinkUrl(token: string): string {
  const callbackUrl = new URL('/login/callback', env.FRONTEND_MAGIC_LINK_ORIGIN);
  callbackUrl.searchParams.set('token', token);
  return callbackUrl.toString();
}

function deriveCapabilities(input: {
  readonly canAdmin: boolean;
  readonly canPlayer: boolean;
  readonly isHeliosMember: boolean;
  readonly legacyRole: 'ADMIN' | 'HELIOS' | 'PLAYER';
  readonly legacyIsHelios: boolean;
}): AuthCapabilities {
  const admin = input.canAdmin || input.legacyRole === 'ADMIN';
  const player = input.canPlayer || input.legacyRole === 'PLAYER' || input.legacyRole === 'HELIOS';
  const heliosMember =
    input.isHeliosMember || input.legacyIsHelios || input.legacyRole === 'HELIOS';

  return {
    admin,
    player,
    heliosMember,
  };
}

function mapCompatibilityRole(capabilities: AuthCapabilities): PlayerAuthSession['role'] {
  if (capabilities.player && capabilities.heliosMember) {
    return 'helios';
  }

  if (capabilities.player) {
    return 'player';
  }

  return 'admin';
}

function resolveAssignmentStatus(
  teamId: string | null,
  teamStatus: ActivePlayerContext['teamStatus']
): PlayerAuthSession['assignmentStatus'] {
  // Missing team context is treated as unassigned even if a player record exists.
  if (!teamId || !teamStatus) {
    return 'UNASSIGNED';
  }

  if (teamStatus === 'PENDING') {
    return 'ASSIGNED_PENDING';
  }

  return 'ASSIGNED_ACTIVE';
}

/**
 * Maps database enrollment details to the API auth session contract.
 */
function buildSessionFromCandidate(input: AuthCandidate): PlayerAuthSession {
  return {
    userId: input.userId,
    playerId: input.activePlayer?.playerId ?? null,
    eventId: input.activePlayer?.eventId ?? null,
    teamId: input.activePlayer?.teamId ?? null,
    teamStatus: input.activePlayer?.teamStatus ?? null,
    assignmentStatus: resolveAssignmentStatus(
      input.activePlayer?.teamId ?? null,
      input.activePlayer?.teamStatus ?? null
    ),
    capabilities: input.capabilities,
    role: mapCompatibilityRole(input.capabilities),
    isAuthenticated: true,
    email: input.email,
    displayName: input.displayName,
  };
}

/**
 * Resolves the post-auth navigation destination.
 */
function resolveRedirectPath(session: PlayerAuthSession): VerifyMagicLinkResponse['redirectPath'] {
  if (session.capabilities.player) {
    if (session.assignmentStatus === 'UNASSIGNED') {
      // Dual-capability users fall back to admin when no active player assignment exists.
      if (session.capabilities.admin) {
        return '/admin/game-control';
      }

      return '/waiting-assignment';
    }

    if (session.assignmentStatus === 'ASSIGNED_PENDING') {
      // Canonical pending setup path (legacy /garage is now an alias redirect).
      return '/team-setup';
    }

    // Canonical active race path (legacy /race-hub is now an alias redirect).
    return '/race';
  }

  return '/admin/game-control';
}

function buildRoutingDecision(session: PlayerAuthSession): RoutingDecisionResponse {
  return {
    assignmentStatus: session.assignmentStatus,
    redirectPath: resolveRedirectPath(session),
    eventId: session.eventId,
    playerId: session.playerId,
    teamId: session.teamId,
  };
}

async function loadActivePlayerContextByUserId(
  userId: string,
  scope?: {
    readonly playerId: string;
    readonly eventId: string;
  }
): Promise<ActivePlayerContext | null> {
  const player = await prisma.player.findFirst({
    where: {
      userId,
      ...(scope ? { id: scope.playerId, eventId: scope.eventId } : {}),
      event: {
        status: 'ACTIVE',
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    select: {
      id: true,
      eventId: true,
      teamId: true,
      team: {
        select: {
          status: true,
        },
      },
      event: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!player) {
    return null;
  }

  return {
    playerId: player.id,
    eventId: player.eventId,
    teamId: player.teamId,
    teamStatus: player.team?.status ?? null,
    eventName: player.event.name,
  };
}

async function loadAuthCandidateByEmail(workEmail: string): Promise<AuthCandidate | null> {
  const matches = await prisma.user.findMany({
    where: {
      email: {
        equals: workEmail,
        mode: 'insensitive',
      },
    },
    orderBy: {
      id: 'asc',
    },
    take: 2,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      canAdmin: true,
      canPlayer: true,
      isHeliosMember: true,
      isHelios: true,
    },
  });

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    incrementCounter('auth.magic_link.request.denied.ambiguous_email.total');
    logger.error('Ambiguous auth candidate email match', {
      normalizedWorkEmail: workEmail,
      matchingUserIds: matches.map((match) => match.id),
    });
    return null;
  }

  const user = matches[0];

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    capabilities: deriveCapabilities({
      canAdmin: user.canAdmin,
      canPlayer: user.canPlayer,
      isHeliosMember: user.isHeliosMember,
      legacyRole: user.role,
      legacyIsHelios: user.isHelios,
    }),
    activePlayer: await loadActivePlayerContextByUserId(user.id),
  };
}

/**
 * Resolves an eligible auth candidate from token claims while enforcing active-event
 * participation when a player scope is present.
 */
async function loadAuthCandidateByClaims(claims: {
  readonly userId: string;
  readonly playerId: string | null;
  readonly eventId: string | null;
}): Promise<AuthCandidate | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: claims.userId,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      canAdmin: true,
      canPlayer: true,
      isHeliosMember: true,
      isHelios: true,
    },
  });

  if (!user) {
    return null;
  }

  let activePlayer: ActivePlayerContext | null;
  if (claims.playerId && claims.eventId) {
    activePlayer = await loadActivePlayerContextByUserId(user.id, {
      playerId: claims.playerId,
      eventId: claims.eventId,
    });

    if (!activePlayer) {
      return null;
    }
  } else {
    activePlayer = await loadActivePlayerContextByUserId(user.id);
  }

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    capabilities: deriveCapabilities({
      canAdmin: user.canAdmin,
      canPlayer: user.canPlayer,
      isHeliosMember: user.isHeliosMember,
      legacyRole: user.role,
      legacyIsHelios: user.isHelios,
    }),
    activePlayer,
  };
}

/**
 * Requests a magic link for an eligible user.
 */
export async function requestMagicLink(
  request: RequestMagicLinkRequest
): Promise<RequestMagicLinkResponse> {
  return withTraceSpan('auth.magic_link.request', { workEmail: request.workEmail }, async () => {
    const normalizedEmail = normalizeWorkEmail(request.workEmail);
    const candidate = await loadAuthCandidateByEmail(normalizedEmail);
    logger.debug('Auth candidate loaded', { candidate });

    if (!candidate) {
      incrementCounter('auth.magic_link.request.denied.total');
      throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'No user found for this work email.');
    }

    const hasSupportedCapability = candidate.capabilities.admin || candidate.capabilities.player;
    if (!hasSupportedCapability) {
      incrementCounter('auth.magic_link.request.denied.total');
      throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'No user found for this work email.');
    }

    // Player-only accounts must have an active event player context and assignment.
    if (
      candidate.capabilities.player &&
      !candidate.capabilities.admin &&
      (!candidate.activePlayer ||
        !candidate.activePlayer.teamId ||
        !candidate.activePlayer.teamStatus)
    ) {
      incrementCounter('auth.magic_link.request.denied.total');
      throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'No user found for this work email.');
    }

    const magicLinkToken = createMagicLinkToken({
      userId: candidate.userId,
      playerId: candidate.activePlayer?.playerId ?? null,
      eventId: candidate.activePlayer?.eventId ?? null,
      email: candidate.email,
    });

    const magicLinkUrl = resolveFrontendMagicLinkUrl(magicLinkToken);
    let deliveryStatus: 'dispatched' | 'dispatch_failed' = 'dispatched';
    try {
      await getEmailDispatcher().dispatch({
        templateKey: 'magic_link_login',
        toEmail: candidate.email,
        variables: {
          magicLinkUrl,
          eventName: candidate.activePlayer?.eventName ?? 'Velocity GP',
          expiresInMinutes: env.MAGIC_LINK_TOKEN_TTL_MINUTES,
        },
      });
    } catch (error) {
      deliveryStatus = 'dispatch_failed';
      incrementCounter('auth.magic_link.request.dispatch.failure.total');
      logger.error('Magic link dispatch failed', {
        userId: candidate.userId,
        playerId: candidate.activePlayer?.playerId,
        eventId: candidate.activePlayer?.eventId,
        templateKey: 'magic_link_login',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      });
    }

    incrementCounter('auth.magic_link.request.accepted.total');
    logger.debug('Magic link request accepted', { candidate, deliveryStatus });

    return {
      accepted: true,
      message: GENERIC_MAGIC_LINK_MESSAGE,
      deliveryStatus,
    };
  });
}

/**
 * Validates a magic-link token and returns an authenticated session payload.
 */
export async function verifyMagicLink(
  request: VerifyMagicLinkRequest
): Promise<VerifyMagicLinkResponse> {
  return withTraceSpan('auth.magic_link.verify', {}, async () => {
    let claims;
    try {
      claims = verifyMagicLinkToken(request.token);
    } catch {
      incrementCounter('auth.magic_link.verify.invalid.total');
      throw new AppError(401, 'AUTH_INVALID_LINK', 'Magic link is invalid or expired.');
    }

    const candidate = await loadAuthCandidateByClaims({
      userId: claims.userId,
      playerId: claims.playerId,
      eventId: claims.eventId,
    });

    if (!candidate) {
      incrementCounter('auth.magic_link.verify.invalid.total');
      logger.debug('Magic link verification failed: auth candidate not found', { claims });
      throw new AppError(401, 'AUTH_INVALID_LINK', 'Magic link is invalid or expired.');
    }

    const session = buildSessionFromCandidate(candidate);
    if (
      session.capabilities.player &&
      !session.capabilities.admin &&
      session.assignmentStatus === 'UNASSIGNED'
    ) {
      incrementCounter('auth.magic_link.verify.unassigned.total');
      throw new AppError(
        403,
        'AUTH_ASSIGNMENT_REQUIRED',
        'Player is not assigned to a team for this event.'
      );
    }

    if (
      session.assignmentStatus === 'ASSIGNED_ACTIVE' &&
      session.teamId &&
      session.playerId &&
      session.eventId
    ) {
      try {
        await recordOnboardingCompletedActivity({
          eventId: session.eventId,
          teamId: session.teamId,
          playerId: session.playerId,
          playerName: session.displayName,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.warn('Unable to record onboarding completion team activity event', {
          errorMessage,
          errorStack,
          eventId: session.eventId,
          teamId: session.teamId,
          playerId: session.playerId,
        });
      }
    }

    const sessionToken = createSessionToken({
      userId: session.userId,
      playerId: session.playerId,
      eventId: session.eventId,
      teamId: session.teamId,
      teamStatus: session.teamStatus,
      role: session.role,
      capabilities: session.capabilities,
      email: session.email,
      displayName: session.displayName,
    });

    incrementCounter('auth.magic_link.verify.success.total');
    return {
      sessionToken,
      session,
      redirectPath: resolveRedirectPath(session),
    };
  });
}

/**
 * Resolves and validates session context from the Authorization header.
 */
export async function getSessionFromAuthorizationHeader(
  authorizationHeaderValue: string | undefined
): Promise<SessionResponse> {
  return getSessionFromAuthInputs(authorizationHeaderValue, undefined);
}

/**
 * Resolves and validates session context from Authorization and Cookie headers.
 */
export async function getSessionFromAuthInputs(
  authorizationHeaderValue: string | undefined,
  cookieHeaderValue: string | undefined
): Promise<SessionResponse> {
  return withTraceSpan('auth.session.get', {}, async () => {
    const bearerToken = resolveSessionToken(authorizationHeaderValue, undefined);
    const cookieToken = resolveSessionToken(undefined, cookieHeaderValue);
    const tokenCandidates = [...new Set([bearerToken, cookieToken].filter(Boolean))] as string[];

    if (tokenCandidates.length === 0) {
      const authorizationScheme =
        authorizationHeaderValue?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? null;
      logger.debug('Missing session token in authorization/cookie headers', {
        hasAuthorizationHeader: Boolean(authorizationHeaderValue),
        authorizationScheme,
        hasCookieHeader: Boolean(cookieHeaderValue),
      });
      throw new AppError(401, 'AUTH_MISSING_TOKEN', 'Authentication is required.');
    }

    let claims: ReturnType<typeof verifySessionToken> | null = null;
    for (const tokenCandidate of tokenCandidates) {
      try {
        claims = verifySessionToken(tokenCandidate);
        if (tokenCandidate !== bearerToken && bearerToken) {
          // Keep cookie-auth resilient when stale local bearer storage lags behind valid cookie auth.
          logger.debug(
            'Session auth fell back to cookie token after bearer token verification failed'
          );
        }
        break;
      } catch {
        // Continue trying any remaining auth inputs before returning AUTH_INVALID_SESSION.
      }
    }

    if (!claims) {
      throw new AppError(401, 'AUTH_INVALID_SESSION', 'Session is invalid or expired.');
    }

    const candidate = await loadAuthCandidateByClaims({
      userId: claims.userId,
      playerId: claims.playerId,
      eventId: claims.eventId,
    });

    if (!candidate) {
      throw new AppError(401, 'AUTH_INVALID_SESSION', 'Session is invalid or expired.');
    }

    const session = buildSessionFromCandidate(candidate);
    if (
      session.capabilities.player &&
      !session.capabilities.admin &&
      session.assignmentStatus === 'UNASSIGNED'
    ) {
      throw new AppError(
        403,
        'AUTH_ASSIGNMENT_REQUIRED',
        'Player is not currently assigned to a team.'
      );
    }

    return { session };
  });
}

/**
 * Returns assignment-aware routing details for the authenticated session.
 */
export async function getRoutingDecisionFromAuthorizationHeader(
  authorizationHeaderValue: string | undefined
): Promise<RoutingDecisionResponse> {
  const sessionResponse = await getSessionFromAuthorizationHeader(authorizationHeaderValue);
  return buildRoutingDecision(sessionResponse.session);
}

/**
 * Returns assignment-aware routing details for the authenticated session.
 */
export async function getRoutingDecisionFromAuthInputs(
  authorizationHeaderValue: string | undefined,
  cookieHeaderValue: string | undefined
): Promise<RoutingDecisionResponse> {
  const sessionResponse = await getSessionFromAuthInputs(
    authorizationHeaderValue,
    cookieHeaderValue
  );
  return buildRoutingDecision(sessionResponse.session);
}
