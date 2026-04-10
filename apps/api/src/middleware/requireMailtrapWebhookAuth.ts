import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { UnauthorizedError } from '../utils/appError.js';
import { requireN8nWebhookAuth } from './requireN8nWebhookAuth.js';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

const MAILTRAP_TIMESTAMP_TOLERANCE_SECONDS = 300;

function normalizeSignature(value: string): string {
  return value.startsWith('sha256=') ? value.slice('sha256='.length) : value;
}

function signaturesMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isFreshTimestamp(timestampSeconds: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  return Math.abs(nowSeconds - timestampSeconds) <= MAILTRAP_TIMESTAMP_TOLERANCE_SECONDS;
}

export function requireMailtrapWebhookAuth(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const signatureHeader = request.header('x-mailtrap-signature');
  const timestampHeader = request.header('x-mailtrap-timestamp');
  const hasSignatureHeaders = Boolean(signatureHeader || timestampHeader);

  if (!hasSignatureHeaders) {
    // Backward-compatible fallback while webhook callers migrate to Mailtrap signatures.
    requireN8nWebhookAuth(request, response, next);
    return;
  }

  const requestMetadata = {
    method: request.method,
    path: request.originalUrl,
    ip: request.ip,
    hasSignatureHeader: Boolean(signatureHeader),
    hasTimestampHeader: Boolean(timestampHeader),
  };

  logger.debug('mailtrap webhook auth attempt', requestMetadata);

  if (!signatureHeader || !timestampHeader) {
    logger.warn('mailtrap webhook auth failed: incomplete signature headers', requestMetadata);
    throw new UnauthorizedError('Valid Mailtrap webhook signature is required.');
  }

  const configuredSecret = env.MAILTRAP_WEBHOOK_SECRET;
  if (!configuredSecret) {
    logger.warn('mailtrap webhook auth fallback: secret not configured', requestMetadata);
    requireN8nWebhookAuth(request, response, next);
    return;
  }

  const parsedTimestamp = Number(timestampHeader);
  if (!Number.isInteger(parsedTimestamp) || !isFreshTimestamp(parsedTimestamp)) {
    logger.warn('mailtrap webhook auth failed: invalid or stale timestamp', requestMetadata);
    throw new UnauthorizedError('Valid Mailtrap webhook signature is required.');
  }

  const rawBody = (request as RequestWithRawBody).rawBody;
  if (!rawBody || rawBody.length === 0) {
    logger.warn('mailtrap webhook auth failed: missing raw body', requestMetadata);
    throw new UnauthorizedError('Valid Mailtrap webhook signature is required.');
  }

  const signedPayload = `${timestampHeader}.${rawBody.toString('utf8')}`;
  const expectedSignature = createHmac('sha256', configuredSecret)
    .update(signedPayload)
    .digest('hex');
  const providedSignature = normalizeSignature(signatureHeader);

  if (!signaturesMatch(expectedSignature, providedSignature)) {
    logger.warn('mailtrap webhook auth failed: signature mismatch', requestMetadata);
    throw new UnauthorizedError('Valid Mailtrap webhook signature is required.');
  }

  logger.debug('mailtrap webhook auth success', requestMetadata);
  next();
}
