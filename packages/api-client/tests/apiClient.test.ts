import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../src/client';

describe('ApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the /api base path for leading-slash endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
      ok: true,
      status: 200,
    } as unknown as Response);

    const client = new ApiClient('http://localhost:3000/api');

    await client.get('/events/monaco');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/events/monaco',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('allows absolute endpoints to bypass the API base URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
      ok: true,
      status: 200,
    } as unknown as Response);

    const client = new ApiClient('http://localhost:3000/api');

    await client.get('https://example.com/health');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns failed API envelopes with structured error metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      json: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
        },
      }),
      ok: false,
      status: 400,
    } as unknown as Response);

    const client = new ApiClient('http://localhost:3000/api');

    await expect(client.post('/players', { email: 'not-an-email' })).resolves.toEqual({
      data: undefined,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
      },
      ok: false,
      status: 400,
    });
  });

  it('omits undefined and null query params from request URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
      ok: true,
      status: 200,
    } as unknown as Response);

    const client = new ApiClient('http://localhost:3000/api');

    await client.get('/admin/events/current/roster', {
      q: 'max',
      assignmentStatus: undefined,
      teamId: null,
      limit: 100,
    });

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('q')).toBe('max');
    expect(requestUrl.searchParams.get('limit')).toBe('100');
    expect(requestUrl.searchParams.has('assignmentStatus')).toBe(false);
    expect(requestUrl.searchParams.has('teamId')).toBe(false);
  });
});
