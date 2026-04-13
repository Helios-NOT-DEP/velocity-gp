import fetch from 'node-fetch';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { ValidationError } from '../utils/appError.js';

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

function getN8nWebhookToken(): string {
  if (env.N8N_WEBHOOK_TOKEN) {
    return env.N8N_WEBHOOK_TOKEN;
  }

  if (env.NODE_ENV === 'production') {
    throw new ValidationError('N8N_WEBHOOK_TOKEN must be configured in production.');
  }

  logger.warn(
    'N8N_WEBHOOK_TOKEN is not set — using hardcoded dev fallback. ' +
      'Do not expose this environment to untrusted networks.'
  );
  return 'velocity-gp-dev-webhook-token';
}

const token = getN8nWebhookToken();

/**
 * Calls the n8n webhook with the fully-built prompt string.
 * The `prompt` parameter is produced by `buildLogoPrompt` in garageService and
 * is passed verbatim to the OpenAI image node inside n8n (`$json.prompt`).
 */
export async function generateTeamLogo({ prompt, teamName }: { prompt: string; teamName: string }) {
  logger.info('[n8nService] POST to n8n webhook', {
    url: `${env.N8N_HOST}${env.N8N_IMAGE_API_URL}`,
    teamName,
    promptLength: prompt.length,
  });

  const response = await fetch(env.N8N_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.N8N_IMAGE_API_KEY ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ prompt, teamName, imageFileName: buildImageFileName(teamName) }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('[n8nService] n8n webhook error', { status: response.status, body });
    throw new Error(`N8N API error: ${response.status} ${response.statusText}`);
  }

  const responseText = await response.text();

  if (!responseText || responseText.trim() === '') {
    logger.error('[n8nService] n8n returned empty response body', { status: response.status });
    throw new Error(
      'n8n workflow returned an empty response — check the Respond to Webhook node is configured'
    );
  }

  let data: { imageUrl?: string; imageFileName?: string };
  try {
    data = JSON.parse(responseText) as { imageUrl?: string; imageFileName?: string };
  } catch {
    logger.error('[n8nService] n8n returned non-JSON response', { responseText });
    throw new Error(`n8n returned unexpected response: ${responseText.slice(0, 200)}`);
  }

  // Prefer imageUrl if n8n returns a full URL;
  if (data.imageUrl) {
    return data.imageUrl;
  }

  logger.error('[n8nService] n8n response missing imageUrl and imageFileName fields', { data });
  throw new Error(`n8n response missing imageUrl — got: ${JSON.stringify(data)}`);
}
