/**
 * API Client
 *
 * Centralized HTTP client for all backend communications.
 * Handles request/response formatting, error handling, and auth headers.
 *
 * @module @velocity-gp/api-client
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

interface ParsedApiBody<T> {
  data: T;
  error?: ApiResponse<T>['error'];
}

interface ApiEnvelope<T> {
  data?: T;
  error?: ApiResponse<T>['error'];
  success?: boolean;
}

export interface ApiClientConfig {
  baseUrl?: string;
}

/**
 * Base API client for making requests to backend
 */
export class ApiClient {
  private baseUrl: string;

  constructor(config: ApiClientConfig | string = {}) {
    const raw = typeof config === 'string' ? config : config.baseUrl || this.getDefaultBaseUrl();
    // Normalize: collapse any double (or more) slashes in the path portion, preserving ://
    this.baseUrl = raw.replace(/([^:])(\/\/+)/g, '$1/');
  }

  private getDefaultBaseUrl(): string {
    if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
      const processEnv = (
        globalThis as unknown as { process: { env: Record<string, string | undefined> } }
      ).process.env;
      const host = processEnv.API_HOST || 'localhost';
      const port = processEnv.API_PORT || '3000';
      return `http://${host}:${port}/api`;
    }
    return 'http://localhost:3000/api';
  }

  /**
   * Make an HTTP request
   */
  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.createUrl(endpoint);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const authorizationHeader = readAuthorizationHeaderFromStorage();
    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const parsedBody = await this.parseResponseBody<T>(response);

    return {
      data: parsedBody.data,
      status: response.status,
      ok: response.ok,
      error: parsedBody.error,
    };
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: Record<string, string | number>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  private createUrl(endpoint: string): URL {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(endpoint)) {
      return new URL(endpoint);
    }

    const normalizedBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const normalizedEndpoint = endpoint.replace(/^\/+/, '');

    return new URL(normalizedEndpoint, normalizedBaseUrl);
  }

  private async parseResponseBody<T>(response: globalThis.Response): Promise<ParsedApiBody<T>> {
    const contentType = response.headers?.get?.('content-type') || 'application/json';

    if (!contentType.includes('application/json')) {
      // Non-JSON endpoints are treated as data-less responses by this client abstraction.
      return { data: undefined as T };
    }

    const payload = (await response.json()) as T | ApiEnvelope<T>;

    if (this.isApiEnvelope<T>(payload)) {
      // Preferred contract: `{ success, data|error }` envelope from api-contract/http helpers.
      if (payload.success === false) {
        return {
          data: undefined as T,
          error: payload.error,
        };
      }

      return { data: payload.data as T };
    }

    return { data: payload as T };
  }

  private isApiEnvelope<T>(payload: T | ApiEnvelope<T>): payload is ApiEnvelope<T> {
    return typeof payload === 'object' && payload !== null && 'success' in payload;
  }
}

function readAuthorizationHeaderFromStorage(): string | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  // Shared key aligns with web auth client token persistence.
  const token = globalThis.localStorage.getItem('velocitygp.auth.token');
  if (!token) {
    return null;
  }

  return `Bearer ${token}`;
}
