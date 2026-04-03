import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Adapter, AdapterUser, VerificationToken } from '@auth/core/adapters';

import { createAuthConfig } from '../src/auth/config.js';
import { createApp } from '../src/app/createApp.js';

describe('velocity gp backend', () => {
  const app = createApp();

  it('returns health information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('velocity-gp-bff');
  });

  it('serves placeholder race state data', async () => {
    const response = await request(app).get('/api/events/event-123/players/player-123/race-state');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.playerId).toBe('player-123');
    expect(response.body.data.eventId).toBe('event-123');
  });

  it('validates request bodies', async () => {
    const response = await request(app).post('/api/players').send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns an anonymous auth session when no user is signed in', async () => {
    const response = await request(app).get('/api/auth/session');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      isAuthenticated: false,
      expires: null,
      user: null,
    });
  });

  it('completes the sendgrid magic-link flow and exposes the authenticated session', async () => {
    const users = new Map<string, AdapterUser>();
    const usersByEmail = new Map<string, AdapterUser>();
    const verificationTokens = new Map<string, VerificationToken>();
    let verificationRequestUrl = '';

    const adapter: Adapter = {
      async createUser(data) {
        const user: AdapterUser = {
          id: data.id ?? crypto.randomUUID(),
          email: data.email,
          emailVerified: data.emailVerified ?? null,
          name: data.name ?? null,
          image: data.image ?? null,
        };

        users.set(user.id, user);
        if (user.email) {
          usersByEmail.set(user.email, user);
        }

        return user;
      },
      async getUser(id) {
        return users.get(id) ?? null;
      },
      async getUserByEmail(email) {
        return usersByEmail.get(email) ?? null;
      },
      async getUserByAccount() {
        return null;
      },
      async updateUser(data) {
        const current = users.get(data.id);
        if (!current) {
          throw new Error(`Missing test user ${data.id}`);
        }

        const nextUser: AdapterUser = { ...current, ...data };
        users.set(nextUser.id, nextUser);
        if (nextUser.email) {
          usersByEmail.set(nextUser.email, nextUser);
        }

        return nextUser;
      },
      async linkAccount() {
        return undefined;
      },
      async createSession() {
        throw new Error('JWT session strategy should not create database sessions in this test.');
      },
      async getSessionAndUser() {
        return null;
      },
      async updateSession() {
        return null;
      },
      async deleteSession() {
        return null;
      },
      async createVerificationToken(data) {
        verificationTokens.set(`${data.identifier}:${data.token}`, data);
        return data;
      },
      async useVerificationToken(where) {
        const key = `${where.identifier}:${where.token}`;
        const token = verificationTokens.get(key) ?? null;
        if (token) {
          verificationTokens.delete(key);
        }

        return token;
      },
      async deleteUser(id) {
        const user = users.get(id) ?? null;
        users.delete(id);
        return user;
      },
      async unlinkAccount() {
        return undefined;
      },
    };

    const authConfig = createAuthConfig({
      adapter,
      providers: [
        {
          id: 'sendgrid',
          name: 'Test SendGrid',
          type: 'email',
          from: 'test@velocitygp.dev',
          maxAge: 900,
          async sendVerificationRequest({ url }) {
            verificationRequestUrl = url;
          },
          options: {},
        },
      ],
    });

    const authApp = createApp({ authConfig });
    const agent = request.agent(authApp);

    const csrfResponse = await agent.get('/auth/csrf');
    const csrfToken = csrfResponse.body.csrfToken as string;

    expect(csrfResponse.status).toBe(200);
    expect(csrfToken).toBeTruthy();

    const signInResponse = await agent
      .post('/auth/signin/sendgrid')
      .set('X-Auth-Return-Redirect', '1')
      .type('form')
      .send({
        csrfToken,
        email: 'driver@velocitygp.dev',
        callbackUrl: 'http://localhost:5173/garage',
      });

    expect(signInResponse.status).toBe(200);
    expect(verificationRequestUrl).toContain('/auth/callback/sendgrid?');

    const magicLinkUrl = new URL(verificationRequestUrl);
    const callbackResponse = await agent.get(`${magicLinkUrl.pathname}${magicLinkUrl.search}`);
    const sessionCookies = callbackResponse.headers['set-cookie'];
    const sessionCookieList = Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies];

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe('http://localhost:5173/garage');
    expect(sessionCookieList.some((cookie) => cookie?.includes('authjs.session-token='))).toBe(true);

    const sessionResponse = await agent.get('/api/auth/session');

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.success).toBe(true);
    expect(sessionResponse.body.data.isAuthenticated).toBe(true);
    expect(sessionResponse.body.data.user.email).toBe('driver@velocitygp.dev');
    expect(sessionResponse.body.data.user.id).toBeTruthy();
  });
});
