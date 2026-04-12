/**
 * Dev Mock Routes
 *
 * Local stubs for external services (n8n, etc.) that are not available during
 * local development. Only mounted when NODE_ENV !== 'production'.
 *
 * Usage: set N8N_IMAGE_API_URL=http://localhost:4000/api/dev/mock-logo in .env
 */
import { Router } from 'express';

import { env } from '../config/env.js';

export const devMockRouter = Router();

if (env.NODE_ENV !== 'production') {
  /**
   * Mock n8n logo generation webhook.
   * Accepts the same payload the real n8n workflow expects:
   *   POST { description: string, teamName: string }
   * Returns:
   *   { imageUrl: string }  ← same shape n8nService expects
   */
  devMockRouter.post('/dev/mock-logo', (request, response) => {
    const { teamName = 'Team' } = request.body as { teamName?: string; description?: string };
    const encoded = encodeURIComponent(teamName);
    // Return a distinct colour per call so you can see it changed
    const colour = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const imageUrl = `https://placehold.co/512x512/${colour}/ffffff?text=${encoded}`;
    response.json({ imageUrl });
  });
}
