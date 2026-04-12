import { randomBytes, randomUUID } from 'node:crypto';

import type {
  CreateQRCodeRequest,
  CreateQRCodeResponse,
  DeleteQRCodeResponse,
  ListEventQRCodesResponse,
  QRCodeSummary,
  SetQRCodeStatusRequest,
  SetQRCodeStatusResponse,
} from '@velocity-gp/api-contract';
import { Prisma } from '../../prisma/generated/client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { DependencyError, ValidationError } from '../utils/appError.js';
import { type AdminActionContext, resolveActorUserId } from '../lib/adminActor.js';
import { createHs512Jwt } from '../lib/n8nAuth.js';

// Private helper types for n8n integration.
interface QrGenerationRequest {
  readonly id: string;
  readonly url: string;
}

interface QrGenerationResponse {
  readonly id?: string;
  readonly url?: string;
  readonly qrImageURL?: string;
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function toISOStringOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toQRCodeSummary(qrCode: {
  id: string;
  eventId: string;
  label: string;
  value: number;
  zone: string | null;
  payload: string;
  qrImageUrl: string | null;
  status: 'ACTIVE' | 'DISABLED';
  scanCount: number;
  hazardRatioOverride: number | null;
  hazardWeightOverride: number | null;
  activationStartsAt: Date | null;
  activationEndsAt: Date | null;
}): QRCodeSummary {
  return {
    id: qrCode.id,
    eventId: qrCode.eventId,
    label: qrCode.label,
    value: qrCode.value,
    zone: qrCode.zone,
    payload: qrCode.payload,
    qrImageUrl: qrCode.qrImageUrl,
    status: qrCode.status,
    scanCount: qrCode.scanCount,
    hazardRatioOverride: qrCode.hazardRatioOverride,
    hazardWeightOverride: qrCode.hazardWeightOverride,
    activationStartsAt: toISOStringOrNull(qrCode.activationStartsAt),
    activationEndsAt: toISOStringOrNull(qrCode.activationEndsAt),
  };
}

function getN8nWebhookUrl(): string {
  if (!env.N8N_HOST) {
    throw new ValidationError('N8N_HOST must be configured for QR asset generation.');
  }
  const baseUrl = env.N8N_HOST;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const environmentSegment = env.NODE_ENV === 'production' ? 'prod' : 'dev';
  // Keep the webhook path environment-configurable with a single template variable.
  const webhookPath = env.N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE.replace('{env}', environmentSegment);

  return `${normalizedBase}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`;
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

function buildQrPayload(): string {
  const entropy = randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 12);
  return `VG-${entropy}`;
}

function buildTrustedScanUrl(payload: string): string {
  const trustedOrigin = env.FRONTEND_MAGIC_LINK_ORIGIN;
  const originWithNoTrailingSlash = trustedOrigin.endsWith('/')
    ? trustedOrigin.slice(0, -1)
    : trustedOrigin;

  return `${originWithNoTrailingSlash}/scan/${encodeURIComponent(payload)}`;
}

/**
 * Requests the generation of a downloadable QR code asset via an external n8n webhook.
 * Connects securely to the N8N instance via HS512 JWT verification.
 *
 * @param input - The unique QR ID and the trusted URL payload it should encode.
 * @returns The verifiable absolute URL string for the externally hosted QR code image.
 * @throws {DependencyError} If the n8n webhook fails, times out, or returns an invalid URL format.
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
        'x-velocity-event': 'QR_CODE_GENERATE',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ id: input.id, url: input.url }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new DependencyError(`QR asset generation failed with status ${response.status}.`, {
        status: response.status,
      });
    }

    const payload = (await response.json()) as QrGenerationResponse;
    if (typeof payload.qrImageURL !== 'string' || payload.qrImageURL.length === 0) {
      throw new DependencyError('QR asset generation response did not include qrImageURL.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(payload.qrImageURL);
    } catch {
      throw new DependencyError('QR asset generation response provided a malformed qrImageURL.', {
        qrImageURL: payload.qrImageURL,
      });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new DependencyError(
        'QR asset generation response provided an unsafe qrImageURL protocol.',
        {
          protocol: parsedUrl.protocol,
        }
      );
    }

    return parsedUrl.toString();
  } catch (error) {
    logger.error('admin QR asset generation failed', {
      endpoint,
      correlationId,
      error: error instanceof Error ? error.message : 'unknown error',
    });

    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Retrieves the full active inventory of QR codes for an event.
 * Excludes soft-deleted QR codes.
 *
 * @param eventId - The unique identifier of the event context.
 * @returns An array of QR codes summarizing current stats, logic overrides, and scanning activity.
 */
export async function listAdminQRCodes(eventId: string): Promise<ListEventQRCodesResponse> {
  const qrCodes = await prisma.qRCode.findMany({
    where: {
      eventId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      eventId: true,
      label: true,
      value: true,
      zone: true,
      payload: true,
      qrImageUrl: true,
      status: true,
      scanCount: true,
      hazardRatioOverride: true,
      hazardWeightOverride: true,
      activationStartsAt: true,
      activationEndsAt: true,
    },
  });

  return {
    eventId,
    qrCodes: qrCodes.map(toQRCodeSummary),
  };
}

/**
 * Creates a new QR code within the event inventory, orchestrating database records,
 * n8n asset generation, and audit logging simultaneously within a transaction.
 *
 * @param eventId - The unique identifier of the event.
 * @param request - Configuration options including physical label, points value, and activation windows.
 * @param context - The context containing the identity of the Admin acting upon the platform.
 * @returns A summary representation of the created code alongside its transaction audit ID.
 * @throws {ValidationError} If a QR with the requested label already exists or the event is missing.
 */
export async function createAdminQRCode(
  eventId: string,
  request: CreateQRCodeRequest,
  context: AdminActionContext = {}
): Promise<CreateQRCodeResponse> {
  return withTraceSpan('admin.qr_code.create', { eventId }, async () => {
    const [eventExists, duplicateLabel] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      }),
      prisma.qRCode.findFirst({
        where: { eventId, label: request.label },
        select: { id: true },
      }),
    ]);

    if (!eventExists) {
      throw new ValidationError('Event does not exist for QR code creation.', {
        eventId,
      });
    }

    if (duplicateLabel) {
      throw new ValidationError('A QR code with this label already exists for the event.', {
        eventId,
        label: request.label,
      });
    }

    const qrCodeId = `qr-${randomUUID()}`;
    const payload = buildQrPayload();
    const trustedScanUrl = buildTrustedScanUrl(payload);

    try {
      await prisma.qRCode.create({
        data: {
          id: qrCodeId,
          eventId,
          label: request.label,
          value: request.value,
          zone: request.zone ?? null,
          payload,
          qrImageUrl: null,
          status: 'ACTIVE',
          activationStartsAt: request.activationStartsAt
            ? new Date(request.activationStartsAt)
            : null,
          activationEndsAt: request.activationEndsAt ? new Date(request.activationEndsAt) : null,
          hazardRatioOverride: null,
          hazardWeightOverride: null,
        },
      });
    } catch (error) {
      if (isKnownPrismaError(error)) {
        if (error.code === 'P2002') {
          throw new ValidationError('A QR code with this label already exists for the event.', {
            eventId,
            label: request.label,
          });
        }

        if (error.code === 'P2003') {
          throw new ValidationError('Event does not exist for QR code creation.', {
            eventId,
          });
        }
      }

      throw error;
    }

    let qrImageUrl: string;
    try {
      qrImageUrl = await generateQrAsset({ id: qrCodeId, url: trustedScanUrl });
    } catch (error) {
      await prisma.qRCode.deleteMany({
        where: {
          id: qrCodeId,
          eventId,
          qrImageUrl: null,
        },
      });

      throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);

      const updatedQrCode = await tx.qRCode.update({
        where: { id: qrCodeId },
        data: {
          qrImageUrl,
        },
        select: {
          id: true,
          eventId: true,
          label: true,
          value: true,
          zone: true,
          payload: true,
          qrImageUrl: true,
          status: true,
          scanCount: true,
          hazardRatioOverride: true,
          hazardWeightOverride: true,
          activationStartsAt: true,
          activationEndsAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'QR_CREATED',
          targetType: 'QR_CODE',
          targetId: updatedQrCode.id,
          details: {
            label: updatedQrCode.label,
            value: updatedQrCode.value,
            zone: updatedQrCode.zone,
            activationStartsAt: toISOStringOrNull(updatedQrCode.activationStartsAt),
            activationEndsAt: toISOStringOrNull(updatedQrCode.activationEndsAt),
            qrImageUrl,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId,
        qrCode: toQRCodeSummary(updatedQrCode),
        auditId: audit.id,
      };
    });

    incrementCounter('admin.qr_code.created');
    return result;
  });
}

/**
 * Updates the operational status (ACTIVE/DISABLED) of an existing QR code.
 * Used by admins to manually disable specific hazards or objectives mid-event.
 *
 * @param eventId - The unique identifier of the event.
 * @param qrCodeId - The unique identifier of the QR code being operated on.
 * @param request - Payload detailing the target status and an optional audit reason.
 * @param context - Admin contextual identity.
 * @returns Updated status configuration and its associated audit ID.
 * @throws {ValidationError} If the requested QR code does not exist.
 */
export async function setAdminQRCodeStatus(
  eventId: string,
  qrCodeId: string,
  request: SetQRCodeStatusRequest,
  context: AdminActionContext = {}
): Promise<SetQRCodeStatusResponse> {
  return withTraceSpan(
    'admin.qr_code.status.update',
    { eventId, qrCodeId, status: request.status },
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const actorId = await resolveActorUserId(tx, context.actorUserId);

        const qrCode = await tx.qRCode.findFirst({
          where: {
            id: qrCodeId,
            eventId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!qrCode) {
          throw new ValidationError('QR code does not exist for this event.', {
            eventId,
            qrCodeId,
          });
        }

        const updatedQrCode = await tx.qRCode.update({
          where: { id: qrCode.id },
          data: { status: request.status },
          select: {
            id: true,
            eventId: true,
            status: true,
            updatedAt: true,
          },
        });

        const audit = await tx.adminActionAudit.create({
          data: {
            eventId,
            actorUserId: actorId,
            actionType: 'QR_STATUS_UPDATED',
            targetType: 'QR_CODE',
            targetId: qrCode.id,
            details: {
              previousStatus: qrCode.status,
              nextStatus: updatedQrCode.status,
              reason: request.reason,
            },
          },
          select: {
            id: true,
          },
        });

        return {
          eventId: updatedQrCode.eventId,
          qrCodeId: updatedQrCode.id,
          status: updatedQrCode.status,
          updatedAt: updatedQrCode.updatedAt.toISOString(),
          auditId: audit.id,
        };
      });

      incrementCounter('admin.qr_code.status.updated', { status: result.status });
      return result;
    }
  );
}

/**
 * Soft deletes a QR code, immediately disabling its ability to accept new scans
 * and hiding it from list queries. Retains the code for database integrity and history.
 *
 * @param eventId - The unique identifier of the event.
 * @param qrCodeId - The unique identifier of the QR code to be deleted.
 * @param context - Admin contextual identity.
 * @returns Deletion timestamp and its associated audit ID.
 * @throws {ValidationError} If the requested QR code does not exist.
 */
export async function softDeleteAdminQRCode(
  eventId: string,
  qrCodeId: string,
  context: AdminActionContext = {}
): Promise<DeleteQRCodeResponse> {
  return withTraceSpan('admin.qr_code.delete', { eventId, qrCodeId }, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);

      const qrCode = await tx.qRCode.findFirst({
        where: {
          id: qrCodeId,
          eventId,
          deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          deletedAt: true,
        },
      });

      if (!qrCode) {
        throw new ValidationError('QR code does not exist for this event.', { eventId, qrCodeId });
      }

      const deleted = await tx.qRCode.update({
        where: {
          id: qrCode.id,
        },
        data: {
          deletedAt: new Date(),
          status: 'DISABLED',
        },
        select: {
          id: true,
          eventId: true,
          deletedAt: true,
        },
      });

      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'QR_DELETED',
          targetType: 'QR_CODE',
          targetId: deleted.id,
          details: {
            label: qrCode.label,
            deletedAt: deleted.deletedAt?.toISOString() ?? null,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId: deleted.eventId,
        qrCodeId: deleted.id,
        deletedAt: deleted.deletedAt?.toISOString() ?? new Date().toISOString(),
        auditId: audit.id,
      };
    });

    incrementCounter('admin.qr_code.deleted');
    return result;
  });
}
