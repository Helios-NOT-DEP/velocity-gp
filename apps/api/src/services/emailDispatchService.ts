import { Buffer } from 'node:buffer';
import { createHmac, randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';

export type EmailTemplateKey =
  | 'magic_link_login'
  | 'welcome_onboarding'
  | 'race_reminder'
  | 'admin_alert';

export interface EmailDispatchInput {
  readonly templateKey: EmailTemplateKey;
  readonly toEmail: string;
  readonly variables: Record<string, unknown>;
  readonly correlationId?: string;
}

export interface EmailDispatcher {
  dispatch(input: EmailDispatchInput): Promise<void>;
}

function sanitizeWebhookUrlForLogs(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function encodeBase64UrlJson(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function redactTokenLikeValues(message: string, token: string): string {
  return message
    .replaceAll(token, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
}

function createHs512Jwt(secret: string, correlationId: string): string {
  const issuedAtEpochSeconds = Math.floor(Date.now() / 1000);
  const expiryEpochSeconds = issuedAtEpochSeconds + 60;
  const header = encodeBase64UrlJson({
    alg: 'HS512',
    typ: 'JWT',
  });
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

class NoopEmailDispatcher implements EmailDispatcher {
  async dispatch(input: EmailDispatchInput): Promise<void> {
    logger.info('email dispatch skipped: n8n email webhook is not configured', {
      toEmail: input.toEmail,
      templateKey: input.templateKey,
    });
  }
}

class N8nEmailDispatcher implements EmailDispatcher {
  readonly #url: string;
  readonly #token: string;
  readonly #timeoutMs: number;
  readonly #loggableUrl: string;

  constructor(url: string, token: string, timeoutMs: number) {
    this.#url = url + '/sendmail';
    this.#token = token;
    this.#timeoutMs = timeoutMs;
    this.#loggableUrl = sanitizeWebhookUrlForLogs(this.#url);
  }

  async dispatch(input: EmailDispatchInput): Promise<void> {
    const correlationId = input.correlationId ?? randomUUID();

    return withTraceSpan(
      'email.dispatch',
      { templateKey: input.templateKey, provider: 'n8n_mailtrap' },
      async () => {
        const startTimeMs = Date.now();
        logger.debug('email dispatch attempt to n8n', {
          provider: 'n8n_mailtrap',
          templateKey: input.templateKey,
          toEmail: input.toEmail,
          correlationId,
          timeoutMs: this.#timeoutMs,
          endpoint: this.#loggableUrl,
        });

        const abortController = new globalThis.AbortController();
        const timeout = setTimeout(() => abortController.abort(), this.#timeoutMs);
        let responseStatus: number | null = null;
        const jwt = createHs512Jwt(this.#token, correlationId);

        try {
          const response = await fetch(this.#url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${jwt}`,
              'x-velocity-event': 'EMAIL_DISPATCH',
              'x-correlation-id': correlationId,
            },
            body: JSON.stringify({
              templateKey: input.templateKey,
              toEmail: input.toEmail,
              variables: input.variables,
              correlationId,
            }),
            signal: abortController.signal,
          });

          responseStatus = response.status;

          if (!response.ok) {
            const failureContext = {
              provider: 'n8n_mailtrap',
              templateKey: input.templateKey,
              toEmail: input.toEmail,
              correlationId,
              endpoint: this.#loggableUrl,
              status: response.status,
              durationMs: Date.now() - startTimeMs,
            };

            logger.warn('email dispatch failure from n8n', {
              ...failureContext,
            });

            const baseErrorMessage = `n8n email dispatch failed with status ${response.status}`;
            if (env.NODE_ENV === 'development') {
              throw new Error(`${baseErrorMessage} \n ${JSON.stringify(failureContext)}`);
            }

            throw new Error(baseErrorMessage);
          }

          logger.debug('email dispatch success from n8n', {
            provider: 'n8n_mailtrap',
            templateKey: input.templateKey,
            toEmail: input.toEmail,
            correlationId,
            endpoint: this.#loggableUrl,
            status: response.status,
            durationMs: Date.now() - startTimeMs,
          });

          incrementCounter('email.dispatch.success', { templateKey: input.templateKey });
        } catch (error) {
          if (responseStatus === null) {
            const rawErrorMessage = error instanceof Error ? error.message : 'unknown error';
            const errorMessage =
              env.NODE_ENV === 'development'
                ? rawErrorMessage
                : redactTokenLikeValues(rawErrorMessage, this.#token);

            logger.error('email dispatch error before response from n8n', {
              provider: 'n8n_mailtrap',
              templateKey: input.templateKey,
              toEmail: input.toEmail,
              correlationId,
              endpoint: this.#loggableUrl,
              durationMs: Date.now() - startTimeMs,
              errorMessage,
            });
          }

          incrementCounter('email.dispatch.failure', { templateKey: input.templateKey });
          throw error;
        } finally {
          globalThis.clearTimeout(timeout);
        }
      }
    );
  }
}

let dispatcherOverride: EmailDispatcher | null = null;

function createDefaultDispatcher(): EmailDispatcher {
  if (!env.N8N_HOST || !env.N8N_WEBHOOK_TOKEN) {
    return new NoopEmailDispatcher();
  }

  return new N8nEmailDispatcher(env.N8N_HOST, env.N8N_WEBHOOK_TOKEN, env.N8N_WEBHOOK_TIMEOUT_MS);
}

const defaultDispatcher = createDefaultDispatcher();

export function getEmailDispatcher(): EmailDispatcher {
  return dispatcherOverride ?? defaultDispatcher;
}

export function setEmailDispatcherForTests(dispatcher: EmailDispatcher | null): void {
  dispatcherOverride = dispatcher;
}
