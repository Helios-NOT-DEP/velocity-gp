import type { Session } from '@auth/express';
import { getSession, type ExpressAuthConfig } from '@auth/express';
import type { Request } from 'express';

import type {
  AuthSessionResponse,
  AuthenticatedPlayerContext,
  AuthenticatedUserProfile,
} from '@velocity-gp/api-contract';

import { prisma } from '../db/prisma.js';

interface SessionUserWithIdentity {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

function emptyPlayerContext(): AuthenticatedPlayerContext {
  return {
    playerId: null,
    eventId: null,
    teamId: null,
    hasTeam: false,
  };
}

async function getAuthenticatedUserProfile(
  userId: string | undefined,
  email: string | null | undefined,
  eventId?: string,
  fallback?: {
    name?: string | null;
    image?: string | null;
  }
): Promise<AuthenticatedUserProfile | null> {
  if (!userId || !email) {
    return null;
  }

  const canQueryDatabase = Boolean(process.env.DATABASE_URL);
  const player =
    canQueryDatabase && eventId
      ? await prisma.player.findFirst({
          where: {
            eventId,
            OR: [{ userId }, { email }],
          },
        })
      : null;
  const user = canQueryDatabase
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          image: true,
        },
      })
    : null;

  return {
    id: userId,
    email,
    name: user?.name ?? fallback?.name ?? null,
    image: user?.image ?? fallback?.image ?? null,
    player: player
      ? {
          playerId: player.id,
          eventId: player.eventId,
          teamId: player.teamId,
          hasTeam: Boolean(player.teamId),
        }
      : emptyPlayerContext(),
  };
}

export async function syncPlayerIdentity(userId: string, email: string, eventId?: string): Promise<void> {
  if (!eventId || !process.env.DATABASE_URL) {
    return;
  }

  const player = await prisma.player.findFirst({
    where: {
      eventId,
      OR: [{ userId }, { email }],
    },
  });

  if (!player || player.userId === userId) {
    return;
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { userId },
  });
}

export async function buildAuthSessionResponse(
  request: Request,
  authConfig: ExpressAuthConfig,
  eventId?: string
): Promise<AuthSessionResponse> {
  const session = await getSession(request, authConfig);

  if (!session?.user) {
    return {
      isAuthenticated: false,
      expires: null,
      user: null,
    };
  }

  const user = session.user as SessionUserWithIdentity;
  const profile = await getAuthenticatedUserProfile(user.id, user.email, eventId);
  const enrichedProfile =
    profile &&
    ({
      ...profile,
      name: profile.name ?? user.name ?? null,
      image: profile.image ?? user.image ?? null,
    } satisfies AuthenticatedUserProfile);

  return {
    isAuthenticated: true,
    expires: session.expires ?? null,
    user: enrichedProfile,
  };
}

export async function enrichSessionUser(
  session: Session,
  token: { sub?: string; email?: string | null; name?: string | null; picture?: string | null },
  eventId?: string
): Promise<Session> {
  const profile = await getAuthenticatedUserProfile(token.sub, token.email, eventId, {
    name: token.name,
    image: token.picture,
  });

  if (!profile) {
    return session;
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: profile.id,
      email: profile.email,
      name: token.name ?? profile.name ?? undefined,
      image: token.picture ?? profile.image ?? undefined,
      player: profile.player,
    } as Session['user'],
  };
}
