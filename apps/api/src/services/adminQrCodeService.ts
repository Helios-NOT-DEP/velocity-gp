import { randomBytes, randomUUID } from 'node:crypto';
import JSZip from 'jszip';

import type {
  CreateQRCodeRequest,
  CreateQRCodeResponse,
  DeleteQRCodeResponse,
  ExportQrAssetsRequest,
  ExportQrAssetsResponse,
  ListEventQRCodesResponse,
  QrImportApplyRequest,
  QrImportApplyResponse,
  QrImportPreviewRequest,
  QrImportPreviewResponse,
  QrImportPreviewRow,
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
import { callN8nWebhook } from '../lib/n8nWebhookClient.js';

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

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toPreviewSummary(rows: readonly QrImportPreviewRow[]): QrImportPreviewResponse['summary'] {
  const summary = {
    total: rows.length,
    valid: 0,
    invalid: 0,
    create: 0,
    unchanged: 0,
  };

  for (const row of rows) {
    if (row.isValid) {
      summary.valid += 1;
    } else {
      summary.invalid += 1;
    }

    if (row.action === 'create') {
      summary.create += 1;
    } else if (row.action === 'unchanged') {
      summary.unchanged += 1;
    }
  }

  return summary;
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
  const correlationId = randomUUID();

  try {
    const { data: payload } = (await callN8nWebhook({
      path: env.N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE,
      expandEnvTemplate: true,
      payload: { id: input.id, url: input.url },
      velocityEvent: 'QR_CODE_GENERATE',
      correlationId,
    })) as { data: QrGenerationResponse };

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
        { protocol: parsedUrl.protocol }
      );
    }

    return parsedUrl.toString();
  } catch (error) {
    logger.error('admin QR asset generation failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
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

async function resolveQrImportPreviewRows(
  eventId: string,
  request: QrImportPreviewRequest
): Promise<QrImportPreviewRow[]> {
  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
    },
  });

  if (!event) {
    throw new ValidationError('Event does not exist.', { eventId });
  }

  const existing = await prisma.qRCode.findMany({
    where: {
      eventId,
      deletedAt: null,
    },
    select: {
      id: true,
      label: true,
      value: true,
      zone: true,
      activationStartsAt: true,
      activationEndsAt: true,
      hazardRatioOverride: true,
      hazardWeightOverride: true,
    },
  });
  const existingByLabel = new Map(existing.map((item) => [item.label.trim().toLowerCase(), item]));

  const labelCount = new Map<string, number>();
  for (const row of request.rows) {
    const normalizedLabel = row.label.trim().toLowerCase();
    labelCount.set(normalizedLabel, (labelCount.get(normalizedLabel) ?? 0) + 1);
  }

  return request.rows.map((row, index) => {
    const errors: string[] = [];
    const label = row.label.trim();
    const zone = normalizeNullableString(row.zone);
    const normalizedLabel = label.toLowerCase();
    const activationStartsAt = parseOptionalDate(row.activationStartsAt);
    const activationEndsAt = parseOptionalDate(row.activationEndsAt);
    const hazardRatioOverride = row.hazardRatioOverride ?? null;
    const hazardWeightOverride = row.hazardWeightOverride ?? null;

    if (!label) {
      errors.push('Label is required.');
    }

    if (!Number.isFinite(row.value) || row.value <= 0 || !Number.isInteger(row.value)) {
      errors.push('Value must be a positive integer.');
    }

    if (labelCount.get(normalizedLabel) && (labelCount.get(normalizedLabel) ?? 0) > 1) {
      errors.push('Duplicate label in import payload.');
    }

    if (row.activationStartsAt && !activationStartsAt) {
      errors.push('activationStartsAt must be a valid ISO datetime.');
    }
    if (row.activationEndsAt && !activationEndsAt) {
      errors.push('activationEndsAt must be a valid ISO datetime.');
    }
    if (
      activationStartsAt &&
      activationEndsAt &&
      activationStartsAt.getTime() >= activationEndsAt.getTime()
    ) {
      errors.push('activationEndsAt must be later than activationStartsAt.');
    }

    if (
      hazardRatioOverride !== null &&
      (!Number.isInteger(hazardRatioOverride) || hazardRatioOverride < 1)
    ) {
      errors.push('hazardRatioOverride must be a positive integer when provided.');
    }

    if (
      hazardWeightOverride !== null &&
      (!Number.isInteger(hazardWeightOverride) ||
        hazardWeightOverride < 0 ||
        hazardWeightOverride > 100)
    ) {
      errors.push('hazardWeightOverride must be an integer from 0-100 when provided.');
    }

    const existingRow = existingByLabel.get(normalizedLabel) ?? null;
    const unchanged =
      existingRow &&
      existingRow.value === row.value &&
      (existingRow.zone ?? null) === zone &&
      (existingRow.activationStartsAt?.toISOString() ?? null) ===
        (activationStartsAt ? activationStartsAt.toISOString() : null) &&
      (existingRow.activationEndsAt?.toISOString() ?? null) ===
        (activationEndsAt ? activationEndsAt.toISOString() : null) &&
      (existingRow.hazardRatioOverride ?? null) === hazardRatioOverride &&
      (existingRow.hazardWeightOverride ?? null) === hazardWeightOverride;

    if (existingRow && !unchanged) {
      errors.push('Label already exists for this event.');
    }

    return {
      rowNumber: index + 2,
      label,
      value: row.value,
      zone,
      activationStartsAt: activationStartsAt ? activationStartsAt.toISOString() : null,
      activationEndsAt: activationEndsAt ? activationEndsAt.toISOString() : null,
      hazardRatioOverride,
      hazardWeightOverride,
      action: errors.length > 0 ? 'invalid' : unchanged ? 'unchanged' : 'create',
      isValid: errors.length === 0,
      errors,
      existingQrCodeId: existingRow?.id ?? null,
    } satisfies QrImportPreviewRow;
  });
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

export async function previewQrImport(
  eventId: string,
  request: QrImportPreviewRequest
): Promise<QrImportPreviewResponse> {
  return withTraceSpan('admin.qr_code.import.preview', { eventId }, async () => {
    const rows = await resolveQrImportPreviewRows(eventId, request);
    return {
      rows,
      summary: toPreviewSummary(rows),
    };
  });
}

export async function applyQrImport(
  eventId: string,
  request: QrImportApplyRequest,
  context: AdminActionContext = {}
): Promise<QrImportApplyResponse> {
  return withTraceSpan('admin.qr_code.import.apply', { eventId }, async () => {
    const previewRows = await resolveQrImportPreviewRows(eventId, request);
    const createdQrCodeIds: string[] = [];
    let created = 0;
    let unchanged = 0;
    let invalid = 0;
    let processed = 0;

    for (const row of previewRows) {
      if (!row.isValid || row.action === 'invalid') {
        invalid += 1;
        continue;
      }

      processed += 1;

      if (row.action === 'unchanged') {
        unchanged += 1;
        continue;
      }
      const createdRecord = await createAdminQRCode(
        eventId,
        {
          label: row.label,
          value: row.value,
          zone: row.zone ?? undefined,
          activationStartsAt: row.activationStartsAt ?? undefined,
          activationEndsAt: row.activationEndsAt ?? undefined,
          hazardRatioOverride: row.hazardRatioOverride,
          hazardWeightOverride: row.hazardWeightOverride,
        },
        context
      );
      created += 1;
      createdQrCodeIds.push(createdRecord.qrCode.id);
    }

    const auditId = await prisma.$transaction(async (tx) => {
      const actorId = await resolveActorUserId(tx, context.actorUserId);
      const audit = await tx.adminActionAudit.create({
        data: {
          eventId,
          actorUserId: actorId,
          actionType: 'QR_IMPORT_APPLIED',
          targetType: 'QR_IMPORT',
          details: {
            total: previewRows.length,
            processed,
            invalid,
            created,
            unchanged,
            createdQrCodeIds,
          },
        },
        select: {
          id: true,
        },
      });
      return audit.id;
    });

    return {
      rows: previewRows,
      summary: {
        total: previewRows.length,
        processed,
        invalid,
        created,
        unchanged,
      },
      createdQrCodeIds,
      auditId,
    };
  });
}

export async function exportQrAssets(
  eventId: string,
  request: ExportQrAssetsRequest
): Promise<ExportQrAssetsResponse> {
  return withTraceSpan('admin.qr_code.export', { eventId }, async () => {
    const qrCodes = await prisma.qRCode.findMany({
      where: {
        eventId,
        deletedAt: null,
        ...(request.qrCodeIds?.length
          ? {
              id: {
                in: [...request.qrCodeIds],
              },
            }
          : {}),
      },
      orderBy: {
        label: 'asc',
      },
      select: {
        id: true,
        label: true,
        payload: true,
        zone: true,
        status: true,
        qrImageUrl: true,
      },
    });

    const zip = new JSZip();
    const manifestRows = ['id,label,payload,zone,status,qrImageUrl,assetPath,assetStatus'];

    let failed = 0;
    for (const qrCode of qrCodes) {
      const safeLabel = qrCode.label.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');
      const fileBase = `${safeLabel || 'qr'}-${qrCode.id}`;
      let assetPath = '';
      let assetStatus = 'skipped';

      if (qrCode.qrImageUrl) {
        try {
          const response = await fetch(qrCode.qrImageUrl);
          if (!response.ok) {
            throw new Error(`status=${response.status}`);
          }
          const buffer = await response.arrayBuffer();
          assetPath = `assets/${fileBase}.png`;
          zip.file(assetPath, buffer);
          assetStatus = 'included';
        } catch {
          failed += 1;
          assetStatus = 'fetch_failed';
        }
      }

      manifestRows.push(
        [
          qrCode.id,
          `"${qrCode.label.replace(/"/g, '""')}"`,
          `"${qrCode.payload.replace(/"/g, '""')}"`,
          `"${(qrCode.zone ?? '').replace(/"/g, '""')}"`,
          qrCode.status,
          `"${(qrCode.qrImageUrl ?? '').replace(/"/g, '""')}"`,
          `"${assetPath}"`,
          assetStatus,
        ].join(',')
      );
    }

    zip.file('manifest.csv', `${manifestRows.join('\n')}\n`);
    const archiveBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return {
      eventId,
      fileName: `velocity-gp-qr-assets-${eventId}.zip`,
      mimeType: 'application/zip',
      archiveBase64: archiveBuffer.toString('base64'),
      included: qrCodes.length - failed,
      failed,
    };
  });
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
          hazardRatioOverride: request.hazardRatioOverride ?? null,
          hazardWeightOverride: request.hazardWeightOverride ?? null,
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
