/**
 * API Client
 *
 * Centralized HTTP client for all backend communications.
 * Handles request/response formatting, error handling, and auth headers.
 *
 * @module services/api
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
}

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    message?: string;
  };
  success?: boolean;
}

/**
 * Base API client for making requests to backend
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api') {
    this.baseUrl = baseUrl;
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

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await this.parseResponseBody<T>(response);

    return {
      data,
      status: response.status,
      ok: response.ok,
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

  private async parseResponseBody<T>(response: globalThis.Response): Promise<T> {
    const contentType = response.headers?.get?.('content-type') || 'application/json';

    if (!contentType.includes('application/json')) {
      return undefined as T;
    }

    const payload = (await response.json()) as T | ApiEnvelope<T>;

    if (this.isApiEnvelope<T>(payload)) {
      return payload.data as T;
    }

    return payload as T;
  }

  private isApiEnvelope<T>(payload: T | ApiEnvelope<T>): payload is ApiEnvelope<T> {
    return typeof payload === 'object' && payload !== null && 'success' in payload;
  }
}

export const apiClient = new ApiClient();
