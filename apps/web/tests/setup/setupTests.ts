import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

const originalFetch = globalThis.fetch;
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
const defaultApiResponse = {
  success: false,
  error: {
    code: 'TEST_UNMOCKED_API_REQUEST',
    message: 'Unexpected API request during web test. Stub fetch or apiClient in this test.',
  },
};

function isLocalApiRequest(input: FetchInput): boolean {
  const requestUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  return /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?\/api(?:\/|$)/i.test(
    requestUrl
  );
}

beforeEach(() => {
  const fetchMock = vi.fn(async (input: FetchInput, init?: FetchInit) => {
    if (isLocalApiRequest(input)) {
      const method = (init?.method || 'GET').toUpperCase();
      return new Response(JSON.stringify(defaultApiResponse), {
        status: method === 'GET' ? 401 : 500,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    return originalFetch(input, init);
  });

  vi.stubGlobal('fetch', fetchMock);
  if (typeof window !== 'undefined') {
    window.fetch = fetchMock as typeof window.fetch;
  }

  // Create an explicit mock for localStorage to avoid Node 22's partial/experimental localStorage from breaking tests.
  const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
      getItem: function (key: string) {
        return store[key] || null;
      },
      setItem: function (key: string, value: string) {
        store[key] = value.toString();
      },
      removeItem: function (key: string) {
        delete store[key];
      },
      clear: function () {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: function (i: number) {
        return Object.keys(store)[i] || null;
      },
    };
  })();

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
  if (typeof window !== 'undefined') {
    window.fetch = originalFetch as typeof window.fetch;
  }
});
