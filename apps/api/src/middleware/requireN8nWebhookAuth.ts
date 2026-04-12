import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { UnauthorizedError } from '../utils/appError.js';

function parseBearerToken(authorizationHeaderValue: string | undefined): string | null {
  if (!authorizationHeaderValue) {
    return null;
  }

  const [scheme, token] = authorizationHeaderValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function requireN8nWebhookAuth(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  // Shared bearer-token guard for internal webhook ingress endpoints.
  const authorizationHeader = request.header('authorization');
  const bearerToken = parseBearerToken(authorizationHeader);
  const requestMetadata = {
    method: request.method,
    path: request.originalUrl,
    ip: request.ip,
    hasAuthorizationHeader: Boolean(authorizationHeader),
    hasBearerToken: Boolean(bearerToken),
  };

  logger.debug('n8n webhook auth attempt', requestMetadata);

  const configuredToken = env.N8N_WEBHOOK_TOKEN;
  if (!configuredToken) {
    logger.warn('n8n webhook auth failed: token not configured', requestMetadata);
    throw new UnauthorizedError('Webhook token is not configured.');
  }

  if (!bearerToken) {
    logger.warn('n8n webhook auth failed: missing bearer token', requestMetadata);
    throw new UnauthorizedError('Valid webhook bearer token is required.');
  }

  if (!tokensMatch(configuredToken, bearerToken)) {
    logger.warn('n8n webhook auth failed: invalid bearer token', requestMetadata);
    throw new UnauthorizedError('Valid webhook bearer token is required.');
  }

  logger.debug('n8n webhook auth success', requestMetadata);
  next();
}
