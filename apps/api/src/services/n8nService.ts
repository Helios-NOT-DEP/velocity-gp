import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Signs a short-lived JWT using the N8N_IMAGE_API_KEY secret.
 * n8n's "JWT Auth" webhook validator expects a Bearer JWT in the
 * Authorization header — not the raw secret.
 */
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
  return `team-logo/dev/${slug}-${timestamp}.png`;
}

function signN8nJwt(secret: string): string {
  return jwt.sign({ iss: 'velocity-gp-api' }, secret, { expiresIn: '5m', algorithm: 'HS512' });
}

/**
 * Calls the n8n webhook with the fully-built prompt string.
 * The `prompt` parameter is produced by `buildLogoPrompt` in garageService and
 * is passed verbatim to the OpenAI image node inside n8n (`$json.prompt`).
 */
export async function generateTeamLogo({ prompt, teamName }: { prompt: string; teamName: string }) {
  // Dev fallback: if no n8n URL is configured, return a placeholder so the full
  // garage flow (submit → GENERATING → READY → logo reveal) can be tested locally.
  if (!env.N8N_IMAGE_API_URL) {
    logger.warn(
      '[n8nService] N8N_IMAGE_API_URL not set — returning placeholder logo URL (dev mode)',
      { teamName }
    );
    const encoded = encodeURIComponent(teamName);
    return `https://placehold.co/512x512/0B1E3B/00D4FF?text=${encoded}`;
  }

  logger.info('[n8nService] POST to n8n webhook', {
    url: env.N8N_IMAGE_API_URL,
    teamName,
    promptLength: prompt.length,
  });

  const response = await fetch(env.N8N_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.N8N_IMAGE_API_KEY
        ? { Authorization: `Bearer ${signN8nJwt(env.N8N_IMAGE_API_KEY)}` }
        : {}),
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

  // Prefer imageUrl if n8n returns a full URL; fall back to constructing it
  // from imageFileName + STORAGE_BASE_URL (DigitalOcean Spaces / S3 compatible).
  if (data.imageUrl) {
    return data.imageUrl;
  }

  if (data.imageFileName) {
    const base = (env.STORAGE_BASE_URL ?? 'https://cdn.velocitygp.app').replace(/\/$/, '');
    const imageUrl = `${base}/${data.imageFileName}`;
    logger.info('[n8nService] Constructed imageUrl from STORAGE_BASE_URL + imageFileName', {
      imageUrl,
    });
    return imageUrl;
  }

  logger.error('[n8nService] n8n response missing imageUrl and imageFileName fields', { data });
  throw new Error(`n8n response missing imageUrl — got: ${JSON.stringify(data)}`);
}
