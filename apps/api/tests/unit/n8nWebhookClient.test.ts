import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Module loader helper
// ---------------------------------------------------------------------------

async function loadModule(options: {
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

  vi.doMock('../../src/config/env.js', () => ({
    env: {
      NODE_ENV: options.nodeEnv ?? 'test',
      N8N_HOST: options.n8nHost,
      N8N_WEBHOOK_TOKEN: options.n8nWebhookToken,
      N8N_WEBHOOK_TIMEOUT_MS: options.timeoutMs ?? 1_000,
      N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE: '/webhook/{env}/QRCodeGen',
    },
  }));

  vi.doMock('../../src/lib/logger.js', () => ({ logger }));

  const module = await import('../../src/lib/n8nWebhookClient.js');
  return { ...module, logger };
}

// ---------------------------------------------------------------------------
// resolveN8nHost
// ---------------------------------------------------------------------------

describe('resolveN8nHost', () => {
  it('returns the host when configured', async () => {
    const { resolveN8nHost } = await loadModule({ n8nHost: 'https://n8n.example.com' });
    expect(resolveN8nHost()).toBe('https://n8n.example.com');
  });

  it('strips a trailing slash from the host', async () => {
    const { resolveN8nHost } = await loadModule({ n8nHost: 'https://n8n.example.com/' });
    expect(resolveN8nHost()).toBe('https://n8n.example.com');
  });

  it('throws ValidationError when N8N_HOST is not set', async () => {
    const { resolveN8nHost } = await loadModule({});
    expect(() => resolveN8nHost()).toThrow('N8N_HOST must be configured');
  });
});

// ---------------------------------------------------------------------------
// resolveN8nToken
// ---------------------------------------------------------------------------

describe('resolveN8nToken', () => {
  it('returns the token when configured', async () => {
    const { resolveN8nToken } = await loadModule({ n8nWebhookToken: 'my-secret-token' });
    expect(resolveN8nToken()).toBe('my-secret-token');
  });

  it('returns the dev fallback token and logs a warning in non-production', async () => {
    const { resolveN8nToken, logger } = await loadModule({ nodeEnv: 'development' });
    const token = resolveN8nToken();
    expect(token).toBe('velocity-gp-dev-webhook-token');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('N8N_WEBHOOK_TOKEN is not set')
    );
  });

  it('throws ValidationError in production when token is missing', async () => {
    const { resolveN8nToken } = await loadModule({ nodeEnv: 'production' });
    expect(() => resolveN8nToken()).toThrow('N8N_WEBHOOK_TOKEN must be configured in production');
  });
});

// ---------------------------------------------------------------------------
// expandN8nPathTemplate
// ---------------------------------------------------------------------------

describe('expandN8nPathTemplate', () => {
  it('expands {env} to "prod" in production', async () => {
    const { expandN8nPathTemplate } = await loadModule({ nodeEnv: 'production' });
    expect(expandN8nPathTemplate('/QRCodeGen')).toBe('/QRCodeGen');
  });

  it('expands {env} to "dev" in non-production', async () => {
    const { expandN8nPathTemplate } = await loadModule({ nodeEnv: 'development' });
    expect(expandN8nPathTemplate('/QRCodeGen')).toBe('/QRCodeGen');
  });

  it('returns the template unchanged when it has no {env} placeholder', async () => {
    const { expandN8nPathTemplate } = await loadModule({});
    expect(expandN8nPathTemplate('/logo/generate')).toBe('/logo/generate');
  });
});

// ---------------------------------------------------------------------------
// callN8nWebhook — URL construction
// ---------------------------------------------------------------------------

describe('callN8nWebhook URL construction', () => {
  it('joins host and path correctly', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'secret-token-16c',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await callN8nWebhook({
      path: '/sendmail',
      payload: { foo: 'bar' },
      velocityEvent: 'EMAIL_DISPATCH',
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://n8n.example.com/sendmail');
  });

  it('adds a leading slash when the path is missing one', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'secret-token-16c',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await callN8nWebhook({
      path: 'logo/generate',
      payload: {},
      velocityEvent: 'LOGO_GENERATE',
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://n8n.example.com/logo/generate');
  });

  it('expands {env} template when expandEnvTemplate is true', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'secret-token-16c',
      nodeEnv: 'production',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ qrImageURL: 'https://cdn.example.com/qr.png' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await callN8nWebhook({
      path: '/QRCodeGen',
      expandEnvTemplate: true,
      payload: { id: '1', url: 'https://example.com' },
      velocityEvent: 'QR_CODE_GENERATE',
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://n8n.example.com/QRCodeGen');
  });
});

// ---------------------------------------------------------------------------
// callN8nWebhook — auth header shape
// ---------------------------------------------------------------------------

describe('callN8nWebhook auth header', () => {
  it('sends an HS512 JWT Bearer token', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'super-secret-token-1234',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await callN8nWebhook({
      path: '/sendmail',
      payload: {},
      velocityEvent: 'EMAIL_DISPATCH',
    });

    const requestOptions = fetchSpy.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    const authHeader = requestOptions?.headers?.authorization ?? '';

    expect(authHeader).toMatch(/^Bearer\s+[^\s]+$/);

    const jwt = authHeader.replace(/^Bearer\s+/, '');
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    const header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
    };
    expect(header.alg).toBe('HS512');
    expect(header.typ).toBe('JWT');
  });

  it('sets the x-velocity-event and x-correlation-id headers', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'super-secret-token-1234',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await callN8nWebhook({
      path: '/sendmail',
      payload: {},
      velocityEvent: 'EMAIL_DISPATCH',
      correlationId: 'test-corr-id',
    });

    const requestOptions = fetchSpy.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(requestOptions?.headers?.['x-velocity-event']).toBe('EMAIL_DISPATCH');
    expect(requestOptions?.headers?.['x-correlation-id']).toBe('test-corr-id');
  });
});

// ---------------------------------------------------------------------------
// callN8nWebhook — response handling
// ---------------------------------------------------------------------------

describe('callN8nWebhook response handling', () => {
  it('returns parsed JSON on a successful response', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ imageUrl: 'https://example.com/logo.png' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { status, data } = await callN8nWebhook({
      path: '/logo/generate',
      payload: { prompt: 'test prompt' },
      velocityEvent: 'LOGO_GENERATE',
    });

    expect(status).toBe(200);
    expect(data).toEqual({ imageUrl: 'https://example.com/logo.png' });
  });

  it('throws DependencyError when the HTTP response is non-OK', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    await expect(
      callN8nWebhook({ path: '/sendmail', payload: {}, velocityEvent: 'EMAIL_DISPATCH' })
    ).rejects.toThrow('n8n webhook returned status 502');
  });

  it('includes the HTTP status in the DependencyError details', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const error = await callN8nWebhook({
      path: '/sendmail',
      payload: {},
      velocityEvent: 'EMAIL_DISPATCH',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as { details?: { status?: number } }).details?.status).toBe(503);
  });

  it('throws DependencyError when the response body is empty', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));

    await expect(
      callN8nWebhook({ path: '/logo/generate', payload: {}, velocityEvent: 'LOGO_GENERATE' })
    ).rejects.toThrow('n8n workflow returned an empty response');
  });

  it('throws DependencyError when the response body is not valid JSON', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'not-json' }));

    await expect(
      callN8nWebhook({ path: '/logo/generate', payload: {}, velocityEvent: 'LOGO_GENERATE' })
    ).rejects.toThrow('n8n returned a non-JSON response');
  });
});

// ---------------------------------------------------------------------------
// callN8nWebhook — timeout / abort
// ---------------------------------------------------------------------------

describe('callN8nWebhook timeout', () => {
  it('aborts the fetch if the configured timeout elapses', async () => {
    const { callN8nWebhook } = await loadModule({
      n8nHost: 'https://n8n.example.com',
      n8nWebhookToken: 'my-token-1234',
      timeoutMs: 50,
    });

    let capturedSignal: AbortSignal | undefined;
    const fetchSpy = vi.fn().mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
      capturedSignal = init.signal;
      // Reject when the abort signal fires so callN8nWebhook propagates the error.
      return new Promise<never>((_, reject) => {
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const callPromise = callN8nWebhook({
      path: '/sendmail',
      payload: {},
      velocityEvent: 'EMAIL_DISPATCH',
    });
    // Attach a no-op rejection handler immediately so Node does not raise an
    // unhandled-rejection event while we wait for the abort to fire.
    const handled = callPromise.catch(() => undefined);

    // Wait for the abort to fire (timeout is 50 ms in this module load).
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(capturedSignal?.aborted).toBe(true);

    // The promise should have rejected with the AbortError.
    await expect(callPromise).rejects.toThrow();
    await handled; // ensure cleanup
  }, 2_000);
});
