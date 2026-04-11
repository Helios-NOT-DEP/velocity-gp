import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

import type {
  CreateQRCodeRequest,
  CreateQRCodeResponse,
  DeleteQRCodeResponse,
  ListEventQRCodesResponse,
  QRCodeSummary,
  SetQRCodeStatusRequest,
  SetQRCodeStatusResponse,
} from '@velocity-gp/api-contract';
import type { Prisma } from '../../prisma/generated/client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { ValidationError } from '../utils/appError.js';

interface AdminActionContext {
  readonly actorUserId?: string;
}

interface QrGenerationRequest {
  readonly id: string;
  readonly url: string;
}

interface QrGenerationResponse {
  readonly id?: string;
  readonly url?: string;
  readonly qrImageURL?: string;
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

async function resolveActorUserId(
  tx: Prisma.TransactionClient,
  actorUserId: string | undefined
): Promise<string> {
  if (actorUserId) {
    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: { id: true },
    });
    if (actor) {
      return actor.id;
    }
  }

  const fallbackAdmin = await tx.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!fallbackAdmin) {
    throw new ValidationError('Unable to resolve admin actor for this operation.', {
      actorUserId,
    });
  }

  return fallbackAdmin.id;
}

function encodeBase64UrlJson(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function createHs512Jwt(secret: string, correlationId: string): string {
  const issuedAtEpochSeconds = Math.floor(Date.now() / 1000);
  const expiryEpochSeconds = issuedAtEpochSeconds + 60;
  const header = encodeBase64UrlJson({ alg: 'HS512', typ: 'JWT' });
  const payload = encodeBase64UrlJson({
    iat: issuedAtEpochSeconds,
    exp: expiryEpochSeconds,
    iss: 'velocity-gp-api',
    aud: 'n8n',
    jti: randomUUID(),
    correlationId,
  });

  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac('sha512', secret).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

function getN8nWebhookUrl(): string {
  const baseUrl = env.N8N_HOST ?? 'https://n8n.velocitygp.app';
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
      throw new ValidationError(`QR asset generation failed with status ${response.status}.`, {
        status: response.status,
      });
    }

    const payload = (await response.json()) as QrGenerationResponse;
    if (typeof payload.qrImageURL !== 'string' || payload.qrImageURL.length === 0) {
      throw new ValidationError('QR asset generation response did not include qrImageURL.');
    }

    return payload.qrImageURL;
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

export async function createAdminQRCode(
  eventId: string,
  request: CreateQRCodeRequest,
  context: AdminActionContext = {}
): Promise<CreateQRCodeResponse> {
  return withTraceSpan('admin.qr_code.create', { eventId }, async () => {
    const qrCodeId = `qr-${randomUUID()}`;
    const payload = buildQrPayload();
    const trustedScanUrl = buildTrustedScanUrl(payload);
    const qrImageUrl = await generateQrAsset({ id: qrCodeId, url: trustedScanUrl });

    const result = await prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);

      const createdQrCode = await tx.qRCode.create({
        data: {
          id: qrCodeId,
          eventId,
          label: request.label,
          value: request.value,
          zone: request.zone ?? null,
          payload,
          qrImageUrl,
          status: 'ACTIVE',
          activationStartsAt: request.activationStartsAt
            ? new Date(request.activationStartsAt)
            : null,
          activationEndsAt: request.activationEndsAt ? new Date(request.activationEndsAt) : null,
          hazardRatioOverride: null,
          hazardWeightOverride: null,
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
          targetId: createdQrCode.id,
          details: {
            label: createdQrCode.label,
            value: createdQrCode.value,
            zone: createdQrCode.zone,
            activationStartsAt: toISOStringOrNull(createdQrCode.activationStartsAt),
            activationEndsAt: toISOStringOrNull(createdQrCode.activationEndsAt),
            qrImageUrl,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        eventId,
        qrCode: toQRCodeSummary(createdQrCode),
        auditId: audit.id,
      };
    });

    incrementCounter('admin.qr_code.created');
    return result;
  });
}

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
