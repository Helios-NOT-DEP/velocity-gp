import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
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

function hashesMatch(expected: string, provided: string): boolean {
  const expectedDigest = createHmac('sha512', expected).update(expected).digest();
  const providedDigest = createHmac('sha512', expected).update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

export function requireN8nWebhookAuth(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const configuredToken = env.N8N_WEBHOOK_TOKEN;
  if (!configuredToken) {
    throw new UnauthorizedError('Webhook token is not configured.');
  }

  const bearerToken = parseBearerToken(request.header('authorization'));
  if (!bearerToken || !hashesMatch(configuredToken, bearerToken)) {
    throw new UnauthorizedError('Valid webhook bearer token is required.');
  }

  next();
}
