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
    expect(response.body.data).toMatchObject({
      scannerEnabled: true,
      raceControlState: 'ACTIVE',
      teamStatus: 'ACTIVE',
    });
  });

  it('accepts canonical scan submissions and returns typed outcomes', async () => {
    const safeResponse = await request(app)
      .post(`${apiPrefix}/events/event-123/scans`)
      .send({ playerId: 'player-123', qrPayload: 'VG-GAMMA-03' });

    expect(safeResponse.status).toBe(200);
    expect(safeResponse.body.success).toBe(true);
    expect(safeResponse.body.data.outcome).toBe('SAFE');
    expect(safeResponse.body.data.pointsAwarded).toBeGreaterThan(0);
  });

  it('supports legacy /hazards/scan alias with matching contract shape', async () => {
    const response = await request(app).post(`${apiPrefix}/hazards/scan`).send({
      playerId: 'player-123',
      eventId: 'event-123',
      qrCode: 'VG-UNKNOWN-404',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.outcome).toBe('INVALID');
    expect(response.body.data.errorCode).toBe('QR_NOT_FOUND');
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

  it('updates race control through admin endpoints', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/events/event-123/race-control`)
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'admin')
      .send({ state: 'PAUSED', reason: 'scheduled break' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.eventId).toBe('event-123');
    expect(response.body.data.state).toBe('PAUSED');
  });

  it('validates admin payloads for manual pit control', async () => {
    const response = await request(app)
      .post(`${apiPrefix}/admin/events/event-123/teams/team-1/pit-control`)
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'admin')
      .send({ action: 'INVALID_ACTION' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
