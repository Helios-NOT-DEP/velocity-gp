import request from 'supertest';
import { describe, expect, it } from 'vitest';

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
});
