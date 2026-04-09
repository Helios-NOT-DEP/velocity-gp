import type {
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

const GENERIC_MAGIC_LINK_MESSAGE =
  'If your work email is eligible for this event, you will receive a secure sign-in link shortly.';

interface EligiblePlayer {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'ADMIN' | 'HELIOS' | 'PLAYER';
  readonly teamId: string | null;
  readonly teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null;
  readonly eventName: string;
}

function normalizeWorkEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveFrontendMagicLinkUrl(token: string): string {
  const callbackUrl = new URL('/login/callback', env.FRONTEND_ORIGIN);
  callbackUrl.searchParams.set('token', token);
  return callbackUrl.toString();
}

function mapRole(role: EligiblePlayer['role']): PlayerAuthSession['role'] {
  if (role === 'ADMIN') {
    return 'admin';
  }

  if (role === 'HELIOS') {
    return 'helios';
  }

  return 'player';
}

function resolveAssignmentStatus(teamId: string | null, teamStatus: EligiblePlayer['teamStatus']) {
  if (!teamId || !teamStatus) {
    return 'UNASSIGNED' as const;
  }

  if (teamStatus === 'PENDING') {
    return 'ASSIGNED_PENDING' as const;
  }

  return 'ASSIGNED_ACTIVE' as const;
}

function buildSessionFromEligiblePlayer(input: EligiblePlayer): PlayerAuthSession {
  return {
    userId: input.userId,
    playerId: input.playerId,
    eventId: input.eventId,
    teamId: input.teamId,
    teamStatus: input.teamStatus,
    assignmentStatus: resolveAssignmentStatus(input.teamId, input.teamStatus),
    role: mapRole(input.role),
    isAuthenticated: true,
    email: input.email,
    displayName: input.displayName,
  };
}

function resolveRedirectPath(session: PlayerAuthSession): VerifyMagicLinkResponse['redirectPath'] {
  if (session.assignmentStatus === 'UNASSIGNED') {
    return '/waiting-assignment';
  }

  if (session.assignmentStatus === 'ASSIGNED_PENDING') {
    return '/garage';
  }

  return '/race-hub';
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

async function loadEligiblePlayerByEmail(workEmail: string): Promise<EligiblePlayer | null> {
  const player = await prisma.player.findFirst({
    where: {
      user: {
        email: workEmail,
      },
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
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      },
    },
  });

  if (!player) {
    return null;
  }

  return {
    userId: player.user.id,
    playerId: player.id,
    eventId: player.eventId,
    email: player.user.email,
    displayName: player.user.displayName,
    role: player.user.role,
    teamId: player.teamId,
    teamStatus: player.team?.status ?? null,
    eventName: player.event.name,
  };
}

async function loadEligiblePlayerByClaims(claims: {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
}): Promise<EligiblePlayer | null> {
  const player = await prisma.player.findFirst({
    where: {
      id: claims.playerId,
      userId: claims.userId,
      eventId: claims.eventId,
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
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      },
    },
  });

  if (!player || player.event.status !== 'ACTIVE') {
    return null;
  }

  return {
    userId: player.user.id,
    playerId: player.id,
    eventId: player.eventId,
    teamId: player.teamId,
    teamStatus: player.team?.status ?? null,
    email: player.user.email,
    displayName: player.user.displayName,
    role: player.user.role,
    eventName: player.event.name,
  };
}

export async function requestMagicLink(
  request: RequestMagicLinkRequest
): Promise<RequestMagicLinkResponse> {
  return withTraceSpan('auth.magic_link.request', { workEmail: request.workEmail }, async () => {
    const normalizedEmail = normalizeWorkEmail(request.workEmail);
    const eligiblePlayer = await loadEligiblePlayerByEmail(normalizedEmail);
    logger.debug('Eligible player loaded', { eligiblePlayer });
    if (!eligiblePlayer || !eligiblePlayer.teamId || !eligiblePlayer.teamStatus) {
      incrementCounter('auth.magic_link.request.denied.total');
      return {
        accepted: true,
        message: GENERIC_MAGIC_LINK_MESSAGE,
      };
    }

    const magicLinkToken = createMagicLinkToken({
      userId: eligiblePlayer.userId,
      playerId: eligiblePlayer.playerId,
      eventId: eligiblePlayer.eventId,
      email: eligiblePlayer.email,
    });

    const magicLinkUrl = resolveFrontendMagicLinkUrl(magicLinkToken);
    await getEmailDispatcher().dispatch({
      templateKey: 'magic_link_login',
      toEmail: eligiblePlayer.email,
      variables: {
        magicLinkUrl,
        eventName: eligiblePlayer.eventName,
        expiresInMinutes: env.MAGIC_LINK_TOKEN_TTL_MINUTES,
      },
    });

    incrementCounter('auth.magic_link.request.accepted.total');
    logger.debug('Magic link request accepted', { eligiblePlayer });

    return {
      accepted: true,
      message: GENERIC_MAGIC_LINK_MESSAGE,
    };
  });
}

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

    const eligiblePlayer = await loadEligiblePlayerByClaims({
      userId: claims.userId,
      playerId: claims.playerId,
      eventId: claims.eventId,
    });

    if (!eligiblePlayer) {
      incrementCounter('auth.magic_link.verify.invalid.total');
      logger.debug('Magic link verification failed: eligible player not found', { claims });
      throw new AppError(401, 'AUTH_INVALID_LINK', 'Magic link is invalid or expired.');
    }

    const session = buildSessionFromEligiblePlayer(eligiblePlayer);
    if (session.assignmentStatus === 'UNASSIGNED') {
      incrementCounter('auth.magic_link.verify.unassigned.total');
      throw new AppError(
        403,
        'AUTH_ASSIGNMENT_REQUIRED',
        'Player is not assigned to a team for this event.'
      );
    }

    const sessionToken = createSessionToken({
      userId: session.userId,
      playerId: session.playerId,
      eventId: session.eventId,
      teamId: session.teamId ?? '',
      teamStatus: session.teamStatus ?? 'PENDING',
      role: session.role,
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

function parseBearerToken(authorizationHeaderValue: string | undefined): string | null {
  if (!authorizationHeaderValue) {
    return null;
  }

  const [scheme, token] = authorizationHeaderValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

export async function getSessionFromAuthorizationHeader(
  authorizationHeaderValue: string | undefined
): Promise<SessionResponse> {
  return withTraceSpan('auth.session.get', {}, async () => {
    const token = parseBearerToken(authorizationHeaderValue);
    if (!token) {
      logger.debug('Missing bearer token in authorization header', { authorizationHeaderValue });
      throw new AppError(401, 'AUTH_MISSING_TOKEN', 'Authentication is required.');
    }

    let claims;
    try {
      claims = verifySessionToken(token);
    } catch {
      throw new AppError(401, 'AUTH_INVALID_SESSION', 'Session is invalid or expired.');
    }

    const eligiblePlayer = await loadEligiblePlayerByClaims({
      userId: claims.userId,
      playerId: claims.playerId,
      eventId: claims.eventId,
    });

    if (!eligiblePlayer) {
      throw new AppError(401, 'AUTH_INVALID_SESSION', 'Session is invalid or expired.');
    }

    const session = buildSessionFromEligiblePlayer(eligiblePlayer);
    if (session.assignmentStatus === 'UNASSIGNED') {
      throw new AppError(
        403,
        'AUTH_ASSIGNMENT_REQUIRED',
        'Player is not currently assigned to a team.'
      );
    }

    return { session };
  });
}

export async function getRoutingDecisionFromAuthorizationHeader(
  authorizationHeaderValue: string | undefined
): Promise<RoutingDecisionResponse> {
  const sessionResponse = await getSessionFromAuthorizationHeader(authorizationHeaderValue);
  return buildRoutingDecision(sessionResponse.session);
}
