import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { AuthSessionRole, TeamStatus } from '@velocity-gp/api-contract';

import { env } from '../config/env.js';

/**
 * Stateless HMAC-signed token helpers for magic links and auth sessions.
 *
 * Tokens are compact (`base64url(payload).signature`) and intentionally avoid
 * external dependencies while the auth layer evolves.
 */
export interface MagicLinkTokenClaims {
  readonly kind: 'magic_link';
  readonly tokenId: string;
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly email: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface SessionTokenClaims {
  readonly kind: 'session';
  readonly tokenId: string;
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly teamStatus: TeamStatus;
  readonly role: AuthSessionRole;
  readonly email: string;
  readonly displayName: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

type AuthTokenClaims = MagicLinkTokenClaims | SessionTokenClaims;

/**
 * Resolves signing secret. Throws in production if not configured.
 * In non-production environments falls back to a local dev placeholder.
 */
function getTokenSecret(): string {
  if (env.AUTH_SECRET && env.AUTH_SECRET.trim().length > 0) {
    return env.AUTH_SECRET;
  }

  if (env.NODE_ENV === 'production') {
    // env.ts assertRequiredSecretsInProduction() should have already caught this at
    // startup, but we guard here as a belt-and-suspenders safety net.
    throw new Error('AUTH_SECRET is required in production and must not be empty.');
  }

  return 'velocity-gp-dev-auth-secret';
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha512', getTokenSecret()).update(encodedPayload).digest('base64url');
}

function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

/**
 * Creates a signed token from claims.
 */
function createToken<T extends AuthTokenClaims>(claims: T): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies token shape, signature, and expiry.
 */
function parseToken(token: string): AuthTokenClaims {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Token format is invalid.');
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedSignatureBuffer = Buffer.from(signature, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error('Token signature is invalid.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenClaims;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Token payload is invalid.');
  }

  if (!('kind' in payload) || !('expiresAt' in payload)) {
    throw new Error('Token payload is incomplete.');
  }

  if (typeof payload.expiresAt !== 'number' || isTokenExpired(payload.expiresAt)) {
    throw new Error('Token has expired.');
  }

  return payload;
}

/**
 * Creates a short-lived magic-link token.
 */
export function createMagicLinkToken(input: {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly email: string;
  readonly now?: Date;
}): string {
  const now = input.now ?? new Date();
  const issuedAt = now.getTime();
  const configuredExpiresAt = env.MAGIC_LINK_TOKEN_EXPIRY_DATE
    ? Date.parse(env.MAGIC_LINK_TOKEN_EXPIRY_DATE)
    : Number.NaN;
  const expiresAt = Number.isFinite(configuredExpiresAt)
    ? configuredExpiresAt
    : issuedAt + env.MAGIC_LINK_TOKEN_TTL_MINUTES * 60_000;

  return createToken({
    kind: 'magic_link',
    tokenId: randomUUID(),
    userId: input.userId,
    playerId: input.playerId,
    eventId: input.eventId,
    email: input.email,
    issuedAt,
    expiresAt,
  });
}

/**
 * Creates an authenticated session token.
 */
export function createSessionToken(input: {
  readonly userId: string;
  readonly playerId: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly teamStatus: TeamStatus;
  readonly role: AuthSessionRole;
  readonly email: string;
  readonly displayName: string;
  readonly now?: Date;
}): string {
  const now = input.now ?? new Date();
  const issuedAt = now.getTime();
  const expiresAt = issuedAt + env.AUTH_SESSION_COOKIE_TTL_DAYS * 24 * 60 * 60_000;

  return createToken({
    kind: 'session',
    tokenId: randomUUID(),
    userId: input.userId,
    playerId: input.playerId,
    eventId: input.eventId,
    teamId: input.teamId,
    teamStatus: input.teamStatus,
    role: input.role,
    email: input.email,
    displayName: input.displayName,
    issuedAt,
    expiresAt,
  });
}

/**
 * Verifies and narrows a token to magic-link claims.
 */
export function verifyMagicLinkToken(token: string): MagicLinkTokenClaims {
  const payload = parseToken(token);
  if (payload.kind !== 'magic_link') {
    throw new Error('Token kind is not magic_link.');
  }

  return payload;
}

/**
 * Verifies and narrows a token to session claims.
 */
export function verifySessionToken(token: string): SessionTokenClaims {
  const payload = parseToken(token);
  if (payload.kind !== 'session') {
    throw new Error('Token kind is not session.');
  }

  return payload;
}
