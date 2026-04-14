import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from './logger.js';
import { DependencyError, ValidationError } from '../utils/appError.js';
import { createHs512Jwt } from './n8nAuth.js';

const DEV_FALLBACK_TOKEN = 'velocity-gp-dev-webhook-token';

/**
 * Resolves the base n8n host URL, throwing if unconfigured.
 * Trailing slashes are stripped so callers can append paths with a leading '/'.
 */
export function resolveN8nHost(): string {
  if (!env.N8N_HOST) {
    throw new ValidationError('N8N_HOST must be configured for n8n webhook calls.');
  }
  return env.N8N_HOST.endsWith('/') ? env.N8N_HOST.slice(0, -1) : env.N8N_HOST;
}

/**
 * Resolves the shared n8n webhook signing secret.
 * In non-production environments a hard-coded dev fallback is used safely when the
 * token is not explicitly configured.
 */
export function resolveN8nToken(): string {
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
  return DEV_FALLBACK_TOKEN;
}

/**
 * Expands the `{env}` placeholder in an n8n path template.
 * `NODE_ENV=production` maps to `prod`; all other values map to `dev`.
 */
export function expandN8nPathTemplate(template: string): string {
  const segment = env.NODE_ENV === 'production' ? 'prod' : 'dev';
  return template.replace('{env}', segment);
}

export interface N8nWebhookCallOptions {
  /**
   * Webhook path relative to `N8N_HOST` (e.g. `'/sendmail'`, `'/logo/generate'`).
   * If it contains `{env}`, set `expandEnvTemplate: true`.
   */
  readonly path: string;
  /**
   * When `true`, expands `{env}` in `path` to `'prod'` or `'dev'` based on `NODE_ENV`.
   * Used for the QR code generation webhook path template.
   */
  readonly expandEnvTemplate?: boolean;
  /** JSON-serializable request body sent to n8n. */
  readonly payload: unknown;
  /** Value for the `x-velocity-event` routing header. */
  readonly velocityEvent: string;
  /**
   * Caller-supplied correlation ID for distributed tracing.
   * A random UUID is generated when omitted.
   */
  readonly correlationId?: string;
  /**
   * When `true`, the response body is not read or parsed.
   * Use for fire-and-forget endpoints where the caller only needs the HTTP status.
   * `data` in the returned result will be `null`.
   */
  readonly skipBodyParsing?: boolean;
}

export interface N8nWebhookResult {
  /** HTTP status code returned by n8n. */
  readonly status: number;
  /**
   * Parsed JSON response body. `null` when `skipBodyParsing` is `true`.
   * The caller is responsible for validating the shape before use.
   */
  readonly data: unknown;
}

/**
 * Posts a JSON payload to an n8n webhook over HTTPS, authenticating with a
 * short-lived HS512 JWT and honouring the shared `N8N_WEBHOOK_TIMEOUT_MS` limit.
 *
 * Returns `{ status, data }` where `status` is the HTTP response code and
 * `data` is the parsed response body. When `skipBodyParsing` is `true`, `data`
 * is `null` and the body is not read — useful for fire-and-forget endpoints.
 * The caller is responsible for validating `data` and throwing domain errors.
 *
 * @throws {ValidationError}  `N8N_HOST` or `N8N_WEBHOOK_TOKEN` is not configured.
 * @throws {DependencyError}  The HTTP response was non-OK, empty, or non-JSON.
 */
export async function callN8nWebhook(options: N8nWebhookCallOptions): Promise<N8nWebhookResult> {
  const host = resolveN8nHost();
  const token = resolveN8nToken();
  const correlationId = options.correlationId ?? randomUUID();
  const rawPath = options.expandEnvTemplate ? expandN8nPathTemplate(options.path) : options.path;
  const url = `${host}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
  const jwt = createHs512Jwt(token, correlationId);

  logger.debug('[n8nWebhookClient] posting to n8n webhook', {
    url,
    velocityEvent: options.velocityEvent,
    correlationId,
  });

  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), env.N8N_WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${jwt}`,
        'x-velocity-event': options.velocityEvent,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(options.payload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new DependencyError(`n8n webhook returned status ${response.status}.`, {
        status: response.status,
      });
    }

    if (options.skipBodyParsing) {
      return { status: response.status, data: null };
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new DependencyError(
        'n8n workflow returned an empty response — check the Respond to Webhook node is configured.'
      );
    }

    try {
      return { status: response.status, data: JSON.parse(text) as unknown };
    } catch {
      throw new DependencyError('n8n returned a non-JSON response.', {
        responseText: text.slice(0, 200),
      });
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
