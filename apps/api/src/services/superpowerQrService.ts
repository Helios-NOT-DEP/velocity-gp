import { randomBytes, randomUUID } from 'node:crypto';

import type {
  GetSuperpowerQRResponse,
  HeliosSuperpowerQRAsset,
  RegenerateSuperpowerQRResponse,
} from '@velocity-gp/api-contract';

import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { createHs512Jwt } from '../lib/n8nAuth.js';
import { logger } from '../lib/logger.js';
import {
  DependencyError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.js';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface QrGenerationRequest {
  readonly id: string;
  readonly url: string;
}

interface QrGenerationResponse {
  readonly qrImageURL?: string;
}

function getN8nWebhookUrl(): string {
  if (!env.N8N_HOST) {
    throw new ValidationError('N8N_HOST must be configured for QR asset generation.');
  }
  const base = env.N8N_HOST.endsWith('/') ? env.N8N_HOST.slice(0, -1) : env.N8N_HOST;
  const environmentSegment = env.NODE_ENV === 'production' ? 'prod' : 'dev';
  const webhookPath = env.N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE.replace('{env}', environmentSegment);
  return `${base}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`;
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

/**
 * Builds a unique VG-prefixed payload string for identity-bound QR assets.
 */
function buildSuperpowerPayload(): string {
  const entropy = randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 12);
  return `VG-SP-${entropy}`;
}

function buildTrustedScanUrl(payload: string): string {
  const origin = env.FRONTEND_MAGIC_LINK_ORIGIN;
  const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${normalizedOrigin}/scan/${encodeURIComponent(payload)}`;
}

/**
 * Requests a QR code image from the n8n webhook pipeline.
 *
 * @param input - Unique identifier and the scan URL the QR should encode.
 * @returns Absolute URL of the hosted QR code image.
 * @throws {DependencyError} If the webhook call fails or returns an invalid URL.
 */
async function generateQrAsset(input: QrGenerationRequest): Promise<string> {
  const endpoint = getN8nWebhookUrl();
  const correlationId = randomUUID();
  const token = getN8nWebhookToken();
  const signedJwt = createHs512Jwt(token, correlationId);

  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), env.N8N_WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${signedJwt}`,
        'x-velocity-event': 'SUPERPOWER_QR_GENERATE',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ id: input.id, url: input.url }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new DependencyError(
        `Superpower QR asset generation failed with status ${response.status}.`,
        {
          status: response.status,
        }
      );
    }

    const payload = (await response.json()) as QrGenerationResponse;
    if (typeof payload.qrImageURL !== 'string' || payload.qrImageURL.length === 0) {
      throw new DependencyError('Superpower QR generation response did not include qrImageURL.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(payload.qrImageURL);
    } catch {
      throw new DependencyError(
        'Superpower QR generation response provided a malformed qrImageURL.',
        {
          qrImageURL: payload.qrImageURL,
        }
      );
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new DependencyError(
        'Superpower QR generation response provided an unsafe qrImageURL protocol.',
        { protocol: parsedUrl.protocol }
      );
    }

    return parsedUrl.toString();
  } catch (error) {
    logger.error('Superpower QR asset generation failed', {
      endpoint,
      correlationId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function toAssetDto(asset: {
  id: string;
  userId: string;
  payload: string;
  qrImageUrl: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: Date;
  regeneratedAt: Date | null;
}): HeliosSuperpowerQRAsset {
  return {
    id: asset.id,
    userId: asset.userId,
    payload: asset.payload,
    qrImageUrl: asset.qrImageUrl,
    status: asset.status,
    createdAt: asset.createdAt.toISOString(),
    regeneratedAt: asset.regeneratedAt ? asset.regeneratedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Retrieves the active Superpower QR asset for the given Helios user.
 *
 * If no asset exists yet, one is provisioned on demand so the caller always
 * receives a valid QR on first load.
 *
 * @param userId - The authenticated user's DB identifier.
 * @returns The active {@link GetSuperpowerQRResponse} containing the QR asset.
 * @throws {ForbiddenError} If the user does not have the Helios role.
 * @throws {DependencyError} If QR image generation fails.
 */
export async function getActiveSuperpowerQR(userId: string): Promise<GetSuperpowerQRResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isHelios: true, isHeliosMember: true },
  });

  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (!user.isHelios && !user.isHeliosMember) {
    throw new ForbiddenError('Superpower QR is only available to Helios users.');
  }

  const existing = await prisma.superpowerQRAsset.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return { asset: toAssetDto(existing) };
  }

  // Provision on first access.
  const asset = await provisionNewAsset(userId);
  return { asset: toAssetDto(asset) };
}

/**
 * Revokes the current active Superpower QR and provisions a fresh replacement.
 *
 * The old asset is immediately transitioned to `REVOKED` within the same DB
 * transaction to prevent a window where no active asset exists.
 *
 * @param userId - The authenticated user's DB identifier.
 * @returns The new {@link RegenerateSuperpowerQRResponse} with the fresh QR asset.
 * @throws {ForbiddenError} If the user does not have the Helios role.
 * @throws {DependencyError} If QR image generation fails.
 */
export async function regenerateSuperpowerQR(
  userId: string
): Promise<RegenerateSuperpowerQRResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isHelios: true, isHeliosMember: true },
  });

  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (!user.isHelios && !user.isHeliosMember) {
    throw new ForbiddenError('Superpower QR is only available to Helios users.');
  }

  const oldAsset = await prisma.superpowerQRAsset.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const newAsset = await provisionNewAsset(userId);

  // Revoke the previous asset after generating the new one so that a webhook failure
  // does not leave the user without any active asset.
  if (oldAsset) {
    await prisma.superpowerQRAsset.update({
      where: { id: oldAsset.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }

  // Mark the new asset with a regeneratedAt timestamp when it replaced an existing one.
  const returnedAsset = oldAsset
    ? await prisma.superpowerQRAsset.update({
        where: { id: newAsset.id },
        data: { regeneratedAt: new Date() },
      })
    : newAsset;

  return {
    asset: toAssetDto(returnedAsset),
    revokedAssetId: oldAsset?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Internal provisioning
// ---------------------------------------------------------------------------

async function provisionNewAsset(userId: string) {
  const payload = buildSuperpowerPayload();
  const scanUrl = buildTrustedScanUrl(payload);

  // Use a temporary ID for the webhook call; we'll store the real DB-assigned ID.
  const correlationId = randomUUID();
  const qrImageUrl = await generateQrAsset({ id: correlationId, url: scanUrl });

  return prisma.superpowerQRAsset.create({
    data: {
      userId,
      payload,
      qrImageUrl,
      status: 'ACTIVE',
    },
  });
}
