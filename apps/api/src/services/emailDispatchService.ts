import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { incrementCounter, withTraceSpan } from '../lib/observability.js';
import { callN8nWebhook, resolveN8nToken } from '../lib/n8nWebhookClient.js';
import { DependencyError } from '../utils/appError.js';

/**
 * Outbound email dispatch layer.
 *
 * Uses an n8n webhook when configured and falls back to a noop dispatcher in
 * local/test environments that do not have webhook credentials.
 */
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

/**
 * Removes query fragments and secrets from webhook URLs before logging.
 */
function sanitizeWebhookUrlForLogs(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function redactTokenLikeValues(message: string, token: string): string {
  return message
    .replaceAll(token, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
}

/**
 * No-op dispatcher used when outbound email integration is disabled.
 */
class NoopEmailDispatcher implements EmailDispatcher {
  async dispatch(input: EmailDispatchInput): Promise<void> {
    logger.info('email dispatch skipped: n8n email webhook is not configured', {
      toEmail: input.toEmail,
      templateKey: input.templateKey,
    });
  }
}

/**
 * n8n-backed dispatcher used for production email workflows.
 */
class N8nEmailDispatcher implements EmailDispatcher {
  readonly #token: string;
  readonly #loggableUrl: string;

  constructor(token: string, host: string) {
    this.#token = token;
    this.#loggableUrl = sanitizeWebhookUrlForLogs(
      `${host.endsWith('/') ? host.slice(0, -1) : host}/sendmail`
    );
  }

  async dispatch(input: EmailDispatchInput): Promise<void> {
    const correlationId = input.correlationId ?? randomUUID();

    return withTraceSpan(
      'email.dispatch',
      { templateKey: input.templateKey, provider: 'n8n_mailtrap' },
      async () => {
        const startTimeMs = Date.now();
        logger.info('email dispatch attempt to n8n', {
          provider: 'n8n_mailtrap',
          templateKey: input.templateKey,
          toEmail: input.toEmail,
          correlationId,
          timeoutMs: env.N8N_WEBHOOK_TIMEOUT_MS,
          endpoint: this.#loggableUrl,
        });

        try {
          const { status: responseStatus } = await callN8nWebhook({
            path: '/sendmail',
            payload: {
              templateKey: input.templateKey,
              toEmail: input.toEmail,
              variables: input.variables,
              correlationId,
            },
            velocityEvent: 'EMAIL_DISPATCH',
            correlationId,
            skipBodyParsing: true,
          });

          logger.info('email dispatch success from n8n', {
            provider: 'n8n_mailtrap',
            templateKey: input.templateKey,
            toEmail: input.toEmail,
            correlationId,
            endpoint: this.#loggableUrl,
            status: responseStatus,
            durationMs: Date.now() - startTimeMs,
          });

          incrementCounter('email.dispatch.success', { templateKey: input.templateKey });
        } catch (error) {
          // HTTP-level failure: DependencyError with a numeric `status` detail.
          if (error instanceof DependencyError && typeof error.details?.['status'] === 'number') {
            const httpStatus = error.details['status'] as number;
            const failureContext = {
              provider: 'n8n_mailtrap',
              templateKey: input.templateKey,
              toEmail: input.toEmail,
              correlationId,
              endpoint: this.#loggableUrl,
              status: httpStatus,
              durationMs: Date.now() - startTimeMs,
            };

            logger.warn('email dispatch failure from n8n', failureContext);
            incrementCounter('email.dispatch.failure', { templateKey: input.templateKey });

            const baseErrorMessage = `n8n email dispatch failed with status ${httpStatus}`;
            if (env.NODE_ENV === 'development') {
              throw new Error(`${baseErrorMessage} \n ${JSON.stringify(failureContext)}`, {
                cause: error,
              });
            }
            throw new Error(baseErrorMessage, { cause: error });
          }

          // Pre-response transport error (network failure, timeout, etc.).
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

          incrementCounter('email.dispatch.failure', { templateKey: input.templateKey });
          throw error;
        }
      }
    );
  }
}

let dispatcherOverride: EmailDispatcher | null = null;

function createDefaultDispatcher(): EmailDispatcher {
  if (!env.N8N_HOST || !env.N8N_WEBHOOK_TOKEN) {
    // Local/dev environments can run without outbound provider credentials.
    return new NoopEmailDispatcher();
  }

  return new N8nEmailDispatcher(resolveN8nToken(), env.N8N_HOST);
}

const defaultDispatcher = createDefaultDispatcher();

/**
 * Returns the active email dispatcher implementation.
 */
export function getEmailDispatcher(): EmailDispatcher {
  return dispatcherOverride ?? defaultDispatcher;
}

/**
 * Test-only override for controlling email dispatch behavior in unit/integration
 * tests.
 */
export function setEmailDispatcherForTests(dispatcher: EmailDispatcher | null): void {
  dispatcherOverride = dispatcher;
}
