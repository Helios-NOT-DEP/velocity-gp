import { Buffer } from 'node:buffer';
import { createHmac, randomUUID } from 'node:crypto';

/**
 * Shared n8n webhook authentication utilities.
 *
 * Both `adminQrCodeService` and `emailDispatchService` call n8n webhooks
 * secured by short-lived HS512 JWTs. This module centralizes the JWT
 * construction logic so changes to the token format or TTL propagate
 * everywhere automatically.
 */

/**
 * Encodes a JSON payload as a base64url string, compatible with JWT header/payload segments.
 */
export function encodeBase64UrlJson(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Builds a short-lived HS512 JWT for authenticated n8n webhook calls.
 *
 * Tokens expire after 60 seconds and carry a correlation ID for request tracing.
 *
 * @param secret - The shared webhook signing secret.
 * @param correlationId - A UUID linking this request to downstream n8n logs.
 */
export function createHs512Jwt(secret: string, correlationId: string): string {
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
