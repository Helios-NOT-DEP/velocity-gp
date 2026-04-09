import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function loadEmailDispatchModule(options: {
  n8nHost?: string;
  n8nWebhookToken?: string;
  timeoutMs?: number;
  nodeEnv?: 'development' | 'test' | 'production';
}) {
  vi.resetModules();

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const incrementCounter = vi.fn();
  const withTraceSpan = vi.fn(
    async (_name: string, _attributes: unknown, callback: () => Promise<void>) => {
      return callback();
    }
  );

  vi.doMock('../../src/config/env.js', () => ({
    env: {
      NODE_ENV: options.nodeEnv,
      N8N_HOST: options.n8nHost,
      N8N_WEBHOOK_TOKEN: options.n8nWebhookToken,
      N8N_WEBHOOK_TIMEOUT_MS: options.timeoutMs ?? 1000,
    },
  }));

  vi.doMock('../../src/lib/logger.js', () => ({
    logger,
  }));

  vi.doMock('../../src/lib/observability.js', () => ({
    incrementCounter,
    withTraceSpan,
  }));

  const module = await import('../../src/services/emailDispatchService.js');
  return {
    ...module,
    logger,
    incrementCounter,
    withTraceSpan,
  };
}

describe('emailDispatchService logging', () => {
  it('logs skip when n8n email webhook configuration is missing', async () => {
    const { getEmailDispatcher, logger } = await loadEmailDispatchModule({});

    await getEmailDispatcher().dispatch({
      templateKey: 'magic_link_login',
      toEmail: 'player@example.com',
      variables: { magicLinkUrl: 'https://example.com/link' },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'email dispatch skipped: n8n email webhook is not configured',
      expect.objectContaining({
        toEmail: 'player@example.com',
        templateKey: 'magic_link_login',
      })
    );
  });

  it('logs attempt and success around n8n dispatch calls', async () => {
    const token = 'n8n-email-webhook-token-1234';
    const { getEmailDispatcher, logger } = await loadEmailDispatchModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: token,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => 'accepted',
    });

    vi.stubGlobal('fetch', fetchSpy);

    await getEmailDispatcher().dispatch({
      templateKey: 'magic_link_login',
      toEmail: 'player@example.com',
      variables: { magicLinkUrl: 'https://example.com/link' },
      correlationId: 'corr-123',
    });

    const requestOptions = fetchSpy.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    const authHeader = requestOptions?.headers?.authorization;

    expect(authHeader).toBeTypeOf('string');
    expect(authHeader).toMatch(/^Bearer\s+[^\s]+$/);

    const jwt = authHeader!.replace(/^Bearer\s+/, '');
    const jwtParts = jwt.split('.');
    expect(jwtParts).toHaveLength(3);

    const jwtHeaderSegment = jwtParts[0] ?? '';
    const jwtHeaderJson = Buffer.from(jwtHeaderSegment, 'base64url').toString('utf8');
    const jwtHeader = JSON.parse(jwtHeaderJson) as { alg?: string; typ?: string };

    expect(jwtHeader.alg).toBe('HS512');
    expect(jwtHeader.typ).toBe('JWT');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'email dispatch attempt to n8n',
      expect.objectContaining({
        provider: 'n8n_mailtrap',
        templateKey: 'magic_link_login',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'email dispatch success from n8n',
      expect.objectContaining({
        status: 202,
        correlationId: 'corr-123',
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

  it('logs failure details when n8n responds with a non-success status', async () => {
    const token = 'n8n-email-webhook-token-1234';
    const { getEmailDispatcher, logger } = await loadEmailDispatchModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: token,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'workflow failure',
    });

    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      getEmailDispatcher().dispatch({
        templateKey: 'admin_alert',
        toEmail: 'ops@example.com',
        variables: { message: 'hello' },
        correlationId: 'corr-456',
      })
    ).rejects.toThrow('n8n email dispatch failed with status 500');

    expect(logger.warn).toHaveBeenCalledWith(
      'email dispatch failure from n8n',
      expect.objectContaining({
        status: 500,
        correlationId: 'corr-456',
        templateKey: 'admin_alert',
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

  it('throws concise non-dev errors for n8n failures', async () => {
    const token = 'n8n-email-webhook-token-1234';
    const { getEmailDispatcher } = await loadEmailDispatchModule({
      nodeEnv: 'production',
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: token,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'workflow failure',
    });

    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      getEmailDispatcher().dispatch({
        templateKey: 'admin_alert',
        toEmail: 'ops@example.com',
        variables: { message: 'hello' },
        correlationId: 'corr-456',
      })
    ).rejects.toThrow('n8n email dispatch failed with status 500');

    await expect(
      getEmailDispatcher().dispatch({
        templateKey: 'admin_alert',
        toEmail: 'ops@example.com',
        variables: { message: 'hello' },
        correlationId: 'corr-456',
      })
    ).rejects.not.toThrow('ops@example.com');
  });

  it('redacts token-like values from non-dev transport error logs', async () => {
    const token = 'n8n-email-webhook-token-1234';
    const { getEmailDispatcher, logger } = await loadEmailDispatchModule({
      nodeEnv: 'production',
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: token,
    });

    const fetchSpy = vi
      .fn()
      .mockRejectedValue(
        new Error(
          `transport failed for authorization Bearer header.payload.signature using secret ${token}`
        )
      );

    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      getEmailDispatcher().dispatch({
        templateKey: 'admin_alert',
        toEmail: 'ops@example.com',
        variables: { message: 'hello' },
        correlationId: 'corr-789',
      })
    ).rejects.toThrow('transport failed');

    const errorLogMetadata = logger.error.mock.calls[0]?.[1] as
      | { errorMessage?: string }
      | undefined;
    const errorMessage = errorLogMetadata?.errorMessage ?? '';

    expect(errorMessage).not.toContain(token);
    expect(errorMessage).not.toContain('header.payload.signature');
    expect(errorMessage).toContain('[REDACTED]');
  });
});
