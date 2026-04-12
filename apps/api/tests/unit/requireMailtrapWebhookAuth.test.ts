import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { describe, expect, it, vi } from 'vitest';

interface LoadMiddlewareModuleOptions {
  readonly configuredSecret?: string;
  readonly configuredLegacyToken?: string;
}

async function loadMiddlewareModule(options: LoadMiddlewareModuleOptions = {}) {
  vi.resetModules();

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const legacyAuthMock = vi.fn((_request, _response, next) => {
    next();
  });

  vi.doMock('../../src/config/env.js', () => ({
    env: {
      MAILTRAP_WEBHOOK_SECRET: options.configuredSecret,
      N8N_WEBHOOK_TOKEN: options.configuredLegacyToken,
    },
  }));

  vi.doMock('../../src/lib/logger.js', () => ({
    logger,
  }));

  vi.doMock('../../src/middleware/requireN8nWebhookAuth.js', () => ({
    requireN8nWebhookAuth: legacyAuthMock,
  }));

  const module = await import('../../src/middleware/requireMailtrapWebhookAuth.js');
  return {
    ...module,
    legacyAuthMock,
    logger,
  };
}

function buildRequest(input?: {
  readonly headers?: Record<string, string | undefined>;
  readonly rawBody?: Buffer;
}) {
  const normalizedHeaders = new Map<string, string>();
  Object.entries(input?.headers ?? {}).forEach(([header, value]) => {
    if (value) {
      normalizedHeaders.set(header.toLowerCase(), value);
    }
  });

  return {
    method: 'POST',
    originalUrl: '/api/webhooks/mailtrap/events',
    ip: '127.0.0.1',
    rawBody: input?.rawBody,
    header: vi.fn((name: string) => normalizedHeaders.get(name.toLowerCase())),
  };
}

function signPayload(secret: string, payload: string, timestamp: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

describe('requireMailtrapWebhookAuth', () => {
  it('falls back to legacy bearer middleware when signature headers are not provided', async () => {
    const { requireMailtrapWebhookAuth, legacyAuthMock } = await loadMiddlewareModule({
      configuredSecret: 'mailtrap-secret-123456',
      configuredLegacyToken: 'legacy-token-123456',
    });
    const request = buildRequest();
    const next = vi.fn();

    requireMailtrapWebhookAuth(request as never, {} as never, next);

    expect(legacyAuthMock).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects incomplete signature headers', async () => {
    const { requireMailtrapWebhookAuth } = await loadMiddlewareModule({
      configuredSecret: 'mailtrap-secret-123456',
    });

    const request = buildRequest({
      headers: {
        'x-mailtrap-signature': 'sha256=abc123',
      },
      rawBody: Buffer.from('{"events":[]}'),
    });

    expect(() => {
      requireMailtrapWebhookAuth(request as never, {} as never, vi.fn());
    }).toThrow('Valid Mailtrap webhook signature is required.');
  });

  it('falls back to legacy bearer middleware when secret is not configured', async () => {
    const { requireMailtrapWebhookAuth, legacyAuthMock } = await loadMiddlewareModule({
      configuredSecret: undefined,
    });

    const request = buildRequest({
      headers: {
        'x-mailtrap-signature': 'sha256=abc123',
        'x-mailtrap-timestamp': String(Math.floor(Date.now() / 1_000)),
      },
      rawBody: Buffer.from('{"events":[]}'),
    });

    const next = vi.fn();

    requireMailtrapWebhookAuth(request as never, {} as never, next);

    expect(legacyAuthMock).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects stale timestamps to limit replay windows', async () => {
    const secret = 'mailtrap-secret-123456';
    const payload = '{"events":[]}';
    const staleTimestamp = String(Math.floor(Date.now() / 1_000) - 301);
    const signature = signPayload(secret, payload, staleTimestamp);

    const { requireMailtrapWebhookAuth } = await loadMiddlewareModule({
      configuredSecret: secret,
    });

    const request = buildRequest({
      headers: {
        'x-mailtrap-signature': `sha256=${signature}`,
        'x-mailtrap-timestamp': staleTimestamp,
      },
      rawBody: Buffer.from(payload),
    });

    expect(() => {
      requireMailtrapWebhookAuth(request as never, {} as never, vi.fn());
    }).toThrow('Valid Mailtrap webhook signature is required.');
  });

  it('accepts valid signed webhook payloads', async () => {
    const secret = 'mailtrap-secret-123456';
    const payload = '{"events":[]}';
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const signature = signPayload(secret, payload, timestamp);

    const { requireMailtrapWebhookAuth, logger } = await loadMiddlewareModule({
      configuredSecret: secret,
    });

    const request = buildRequest({
      headers: {
        'x-mailtrap-signature': `sha256=${signature}`,
        'x-mailtrap-timestamp': timestamp,
      },
      rawBody: Buffer.from(payload),
    });
    const next = vi.fn();

    requireMailtrapWebhookAuth(request as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'mailtrap webhook auth success',
      expect.objectContaining({
        path: '/api/webhooks/mailtrap/events',
      })
    );
  });
});
