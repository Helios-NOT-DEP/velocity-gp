import { describe, expect, it, vi } from 'vitest';

async function loadMiddlewareModule(configuredToken?: string) {
  vi.resetModules();

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  vi.doMock('../src/config/env.js', () => ({
    env: {
      N8N_WEBHOOK_TOKEN: configuredToken,
    },
  }));

  vi.doMock('../src/lib/logger.js', () => ({
    logger,
  }));

  const module = await import('../src/middleware/requireN8nWebhookAuth.js');
  return {
    ...module,
    logger,
  };
}

function buildRequest(authorizationHeader: string | undefined) {
  return {
    method: 'POST',
    originalUrl: '/api/webhooks/mailtrap/events',
    ip: '127.0.0.1',
    header: vi.fn((name: string) => {
      if (name.toLowerCase() === 'authorization') {
        return authorizationHeader;
      }
      return undefined;
    }),
  };
}

describe('requireN8nWebhookAuth logging', () => {
  it('logs failed authentication when webhook token is not configured', async () => {
    const { requireN8nWebhookAuth, logger } = await loadMiddlewareModule(undefined);

    const request = buildRequest('Bearer any-token-value');
    const next = vi.fn();

    expect(() => {
      requireN8nWebhookAuth(request as never, {} as never, next);
    }).toThrow('Webhook token is not configured.');

    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'n8n webhook auth failed: token not configured',
      expect.objectContaining({
        path: '/api/webhooks/mailtrap/events',
        method: 'POST',
      })
    );
  });

  it('logs auth attempt and failure for invalid bearer token', async () => {
    const { requireN8nWebhookAuth, logger } = await loadMiddlewareModule(
      'velocity-gp-dev-webhook-token-1234'
    );

    const request = buildRequest('Bearer invalid-webhook-token-0000');
    const next = vi.fn();

    expect(() => {
      requireN8nWebhookAuth(request as never, {} as never, next);
    }).toThrow('Valid webhook bearer token is required.');

    expect(next).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'n8n webhook auth attempt',
      expect.objectContaining({
        hasAuthorizationHeader: true,
        hasBearerToken: true,
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'n8n webhook auth failed: invalid bearer token',
      expect.objectContaining({
        path: '/api/webhooks/mailtrap/events',
      })
    );
  });

  it('logs auth success and proceeds with next middleware for valid bearer token', async () => {
    const token = 'velocity-gp-dev-webhook-token-1234';
    const { requireN8nWebhookAuth, logger } = await loadMiddlewareModule(token);

    const request = buildRequest(`Bearer ${token}`);
    const next = vi.fn();

    requireN8nWebhookAuth(request as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'n8n webhook auth attempt',
      expect.objectContaining({
        hasAuthorizationHeader: true,
        hasBearerToken: true,
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'n8n webhook auth success',
      expect.objectContaining({
        path: '/api/webhooks/mailtrap/events',
      })
    );

    const logsAsText = JSON.stringify([
      ...logger.debug.mock.calls,
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
    ]);

    expect(logsAsText).not.toContain(token);
  });
});
