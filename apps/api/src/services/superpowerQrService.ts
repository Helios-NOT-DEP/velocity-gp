import { randomBytes, randomUUID } from 'node:crypto';

import type {
  GetSuperpowerQRResponse,
  HeliosSuperpowerQRAsset,
  RegenerateSuperpowerQRResponse,
} from '@velocity-gp/api-contract';
import { Prisma } from '../../prisma/generated/client.js';

import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { callN8nWebhook } from '../lib/n8nWebhookClient.js';
import { logger } from '../lib/logger.js';
import { DependencyError, ForbiddenError, NotFoundError } from '../utils/appError.js';

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

const SUPERPOWER_REGEN_RETRY_LIMIT = 3;

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function isRetryableTransactionError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return isKnownPrismaError(error) && (error.code === 'P2002' || error.code === 'P2034');
}

/**
 * Requests a QR code image from the n8n webhook pipeline.
 *
 * @param input - Unique identifier and the scan URL the QR should encode.
 * @returns Absolute URL of the hosted QR code image.
 * @throws {DependencyError} If the webhook call fails or returns an invalid URL.
 */
async function generateQrAsset(input: QrGenerationRequest): Promise<string> {
  const correlationId = randomUUID();

  try {
    const { data } = (await callN8nWebhook({
      path: env.N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE,
      expandEnvTemplate: true,
      payload: { id: input.id, url: input.url },
      velocityEvent: 'SUPERPOWER_QR_GENERATE',
      correlationId,
    })) as { data: QrGenerationResponse };

    if (typeof data.qrImageURL !== 'string' || data.qrImageURL.length === 0) {
      throw new DependencyError('Superpower QR generation response did not include qrImageURL.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(data.qrImageURL);
    } catch {
      throw new DependencyError(
        'Superpower QR generation response provided a malformed qrImageURL.',
        { qrImageURL: data.qrImageURL }
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
      correlationId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}

/**
 * Builds a unique VG-SP-prefixed payload string for identity-bound QR assets.
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
  const asset = await provisionNewAssetIdempotent(userId);
  return { asset: toAssetDto(asset) };
}

/**
 * Revokes the current active Superpower QR and provisions a fresh replacement.
 *
 * QR image generation happens before the DB write so webhook failures do not
 * alter the existing active asset. The subsequent revoke-and-create happens
 * in a single DB transaction.
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

  for (let attempt = 1; attempt <= SUPERPOWER_REGEN_RETRY_LIMIT; attempt += 1) {
    const payload = buildSuperpowerPayload();
    const scanUrl = buildTrustedScanUrl(payload);
    const correlationId = randomUUID();
    const qrImageUrl = await generateQrAsset({ id: correlationId, url: scanUrl });

    const now = new Date();
    try {
      const transactionResult = await prisma.$transaction(
        async (tx) => {
          const currentActive = await tx.superpowerQRAsset.findFirst({
            where: { userId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (currentActive) {
            await tx.superpowerQRAsset.update({
              where: { id: currentActive.id },
              data: {
                status: 'REVOKED',
                revokedAt: now,
              },
            });
          }

          const created = await tx.superpowerQRAsset.create({
            data: {
              userId,
              payload,
              qrImageUrl,
              status: 'ACTIVE',
              regeneratedAt: currentActive ? now : null,
            },
          });

          return {
            asset: created,
            revokedAssetId: currentActive?.id ?? null,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      return {
        asset: toAssetDto(transactionResult.asset),
        revokedAssetId: transactionResult.revokedAssetId,
      };
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < SUPERPOWER_REGEN_RETRY_LIMIT) {
        logger.warn('Retrying Superpower QR regeneration after transaction conflict.', {
          userId,
          attempt,
          errorCode: error.code,
        });
        continue;
      }

      throw error;
    }
  }

  throw new DependencyError('Failed to regenerate Superpower QR after retry attempts.');
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

/**
 * Best-effort idempotent provisioning for first-load races.
 *
 * A DB-level unique index enforces one ACTIVE row per user; concurrent callers
 * that lose the insert race return the ACTIVE row that won.
 */
async function provisionNewAssetIdempotent(userId: string) {
  try {
    return await provisionNewAsset(userId);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === 'P2002') {
      const existing = await prisma.superpowerQRAsset.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}
