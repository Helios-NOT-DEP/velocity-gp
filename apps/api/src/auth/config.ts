import type { Adapter } from '@auth/core/adapters';
import type { Provider } from '@auth/core/providers';
import { ExpressAuth, type ExpressAuthConfig } from '@auth/express';
import SendGrid from '@auth/express/providers/sendgrid';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import { enrichSessionUser, syncPlayerIdentity } from './session.js';

type CreateAuthConfigOptions = {
  adapter?: Adapter;
  providers?: Provider[];
};

const developmentAuthSecret = 'development-auth-secret-change-me-now-123';

function createDefaultProviders(): Provider[] {
  return [
    SendGrid({
      apiKey: env.AUTH_SENDGRID_API_KEY,
      from: env.AUTH_EMAIL_FROM ?? 'no-reply@velocitygp.local',
      maxAge: env.AUTH_MAGIC_LINK_MAX_AGE_SECONDS,
    }),
  ];
}

export function createAuthConfig(options: CreateAuthConfigOptions = {}): ExpressAuthConfig {
  return {
    adapter: options.adapter ?? PrismaAdapter(prisma),
    providers: options.providers ?? createDefaultProviders(),
    secret:
      env.AUTH_SECRET ?? (env.NODE_ENV === 'production' ? undefined : developmentAuthSecret),
    trustHost: true,
    debug: env.AUTH_DEBUG,
    session: {
      strategy: 'jwt',
      maxAge: env.AUTH_SESSION_MAX_AGE_SECONDS,
      updateAge: env.AUTH_SESSION_UPDATE_AGE_SECONDS,
    },
    callbacks: {
      async session({ session, token }) {
        return enrichSessionUser(
          session,
          {
            sub: token.sub,
            email: token.email,
            name: token.name,
            picture: token.picture,
          },
          env.AUTH_EVENT_ID
        );
      },
      async jwt({ token, user }) {
        if (user?.id) {
          token.sub = user.id;
        }

        return token;
      },
    },
    events: {
      async signIn({ user }) {
        if (!user.id || !user.email) {
          return;
        }

        try {
          await syncPlayerIdentity(user.id, user.email, env.AUTH_EVENT_ID);
        } catch (error) {
          logger.error({ err: error, userId: user.id }, 'failed to sync player identity after sign-in');
        }
      },
    },
  };
}

export const authConfig = createAuthConfig();
export { ExpressAuth };
