import { randomUUID } from 'node:crypto';

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

class NoopEmailDispatcher implements EmailDispatcher {
  async dispatch(input: EmailDispatchInput): Promise<void> {
    logger.info(
      { toEmail: input.toEmail, templateKey: input.templateKey },
      'email dispatch skipped: n8n email webhook is not configured'
    );
  }
}

class N8nEmailDispatcher implements EmailDispatcher {
  readonly #url: string;
  readonly #token: string;
  readonly #timeoutMs: number;

  constructor(url: string, token: string, timeoutMs: number) {
    this.#url = url;
    this.#token = token;
    this.#timeoutMs = timeoutMs;
  }

  async dispatch(input: EmailDispatchInput): Promise<void> {
    const correlationId = input.correlationId ?? randomUUID();

    return withTraceSpan(
      'email.dispatch',
      { templateKey: input.templateKey, provider: 'n8n_mailtrap' },
      async () => {
        const abortController = new globalThis.AbortController();
        const timeout = setTimeout(() => abortController.abort(), this.#timeoutMs);

        try {
          const response = await fetch(this.#url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${this.#token}`,
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

          if (!response.ok) {
            throw new Error(`n8n email dispatch failed with status ${response.status}`);
          }

          incrementCounter('email.dispatch.success', { templateKey: input.templateKey });
        } catch (error) {
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
  if (!env.N8N_EMAIL_WEBHOOK_URL || !env.N8N_EMAIL_WEBHOOK_TOKEN) {
    return new NoopEmailDispatcher();
  }

  return new N8nEmailDispatcher(
    env.N8N_EMAIL_WEBHOOK_URL,
    env.N8N_EMAIL_WEBHOOK_TOKEN,
    env.N8N_EMAIL_WEBHOOK_TIMEOUT_MS
  );
}

const defaultDispatcher = createDefaultDispatcher();

export function getEmailDispatcher(): EmailDispatcher {
  return dispatcherOverride ?? defaultDispatcher;
}

export function setEmailDispatcherForTests(dispatcher: EmailDispatcher | null): void {
  dispatcherOverride = dispatcher;
}
