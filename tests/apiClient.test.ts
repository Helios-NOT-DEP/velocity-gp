import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../src/services/api/apiClient';

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

  it('returns failed API envelopes without rejecting the request promise', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      json: vi.fn().mockResolvedValue({
        success: false,
        error: { message: 'Request validation failed.' },
      }),
      ok: false,
      status: 400,
    } as unknown as Response);

    const client = new ApiClient('http://localhost:4000/api');

    await expect(client.post('/players', { email: 'not-an-email' })).resolves.toEqual({
      data: undefined,
      ok: false,
      status: 400,
    });
  });
});
