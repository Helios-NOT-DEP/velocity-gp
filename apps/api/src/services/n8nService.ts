import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { DependencyError } from '../utils/appError.js';
import { callN8nWebhook } from '../lib/n8nWebhookClient.js';

/**
 * Converts a team name into a URL-safe S3 key slug.
 * "Nova Thunder" → "nova-thunder-2026-04-10-03-03-24.png"
 * Rules: lowercase, spaces→hyphens, strip non-alphanumeric (except hyphens), no leading/trailing hyphens.
 */
function buildImageFileName(teamName: string): string {
  const slug = teamName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
  const timestamp = new Date().toISOString().replace(/[T:.]/g, '-').slice(0, 19);
  return `team-logo/${slug}-${timestamp}.png`;
}

/**
 * Calls the n8n webhook with the fully-built prompt string.
 * The `prompt` parameter is produced by `buildLogoPrompt` in garageService and
 * is passed verbatim to the OpenAI image node inside n8n (`$json.prompt`).
 */
export async function generateTeamLogo({ prompt, teamName }: { prompt: string; teamName: string }) {
  const correlationId = randomUUID();

  logger.info('[n8nService] POST to n8n logo webhook', {
    path: env.N8N_IMAGE_API_URL,
    teamName,
    promptLength: prompt.length,
    correlationId,
  });

  const { data } = (await callN8nWebhook({
    path: env.N8N_IMAGE_API_URL,
    payload: { prompt, teamName, imageFileName: buildImageFileName(teamName) },
    velocityEvent: 'LOGO_GENERATE',
    correlationId,
  })) as { data: { imageUrl?: string; imageFileName?: string } };

  if (data.imageUrl) {
    return data.imageUrl;
  }

  logger.error('[n8nService] n8n response missing imageUrl field', { data, correlationId });
  throw new DependencyError(`n8n response missing imageUrl — got: ${JSON.stringify(data)}`);
}
