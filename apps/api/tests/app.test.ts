import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import { env } from '../src/config/env.js';

describe('velocity gp backend', () => {
  const app = createApp();
  const apiPrefix = env.API_PREFIX;

  it('returns health information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('velocity-gp-bff');
  });

  it('serves placeholder race state data', async () => {
    const response = await request(app).get(
      `${apiPrefix}/events/event-123/players/player-123/race-state`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.playerId).toBe('player-123');
    expect(response.body.data.eventId).toBe('event-123');
  });

  it('validates request bodies', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/players`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects admin routes when authentication context is missing', async () => {
    const response = await request(app).get(`${apiPrefix}/admin/session`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects admin routes when authenticated user is not an admin', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/session`)
      .set('x-user-id', 'player-1')
      .set('x-user-role', 'player');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin access for protected admin routes', async () => {
    const response = await request(app)
      .get(`${apiPrefix}/admin/session`)
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.scope).toBe('admin');
    expect(response.body.data.userId).toBe('admin-1');
    expect(response.body.data.role).toBe('admin');
  });
});
