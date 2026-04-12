/**
 * @file client.ts
 * @description Centralized HTTP Client powering frontend data fetching.
 * Seamlessly interfaces with the `@velocity-gp/api-contract` definition objects.
 * Automatically injects authorization headers from LocalStorage, unwraps
 * the standardized `{ success, data, error }` JSON envelopes, and provides
 * normalized error returns bridging HTTP status codes with business logic constraints.
 */

/** Defines permissible configurations passed to REST verbs. */
export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | readonly QueryParamValue[]>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: QueryParams;
}

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccessResponse<T> {
  data: T;
  status: number;
  ok: true;
  error?: undefined;
}

export interface ApiFailureResponse {
  data: undefined;
  status: number;
  ok: false;
  error?: ApiErrorPayload;
}

/**
 * Standardized resolved wrapper returned by every async method on the ApiClient.
 * `ok` is the discriminator: when true, `data` is typed and present.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

interface ParsedApiBody<T> {
  data: T | undefined;
  error?: ApiErrorPayload;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: ApiErrorPayload;
  success?: boolean;
}

/** Configuration object used when bootstrapping a pristine instance of the client. */
export interface ApiClientConfig {
  baseUrl?: string;
}

/**
 * Isomorphic Fetch-wrapper bridging React components/hooks directly to Backend logic.
 * Enforces unified formatting globally via intercept-like behaviors implicitly reading
 * tokens and parsing envelopes cleanly without developer boilerplate.
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
   * Internal wrapper orchestrating the raw Fetch call, parameter mapping,
   * JWT header injection, and envelope unbundling sequence.
   */
  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.createUrl(endpoint);

    // Add query parameters
    if (options.params) {
      this.appendQueryParams(url, options.params);
    }

    const authorizationHeader = readAuthorizationHeaderFromStorage();
    const hasBody = options.body !== undefined;
    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        // Only set Content-Type when a body is present — GET and DELETE requests
        // should not advertise a JSON content type with no payload.
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

    const parsedBody = await this.parseResponseBody<T>(response);

    return {
      ...(response.ok
        ? {
            data: parsedBody.data as T,
            status: response.status,
            ok: true as const,
          }
        : {
            data: undefined,
            status: response.status,
            ok: false as const,
            error: parsedBody.error,
          }),
    };
  }

  /** Executes an HTTP GET request, safely escaping URL parameters automatically. */
  get<T>(endpoint: string, params?: object) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  /** Executes an HTTP POST request, JSON stringifying the body implicitly. */
  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  /** Executes an HTTP PUT request, performing total replacement semantics gracefully. */
  put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  /** Executes an HTTP DELETE request targeting specifically defined endpoint URIs. */
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

  private appendQueryParams(url: URL, params: object): void {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (this.isQueryParamValue(item)) {
            url.searchParams.append(key, String(item));
          }
        });
        return;
      }

      if (this.isQueryParamValue(value)) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  private isQueryParamValue(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  private async parseResponseBody<T>(response: globalThis.Response): Promise<ParsedApiBody<T>> {
    const contentType = response.headers?.get?.('content-type') || 'application/json';

    if (!contentType.includes('application/json')) {
      // Non-JSON endpoints are treated as data-less responses by this client abstraction.
      return { data: undefined };
    }

    const payload = (await response.json()) as T | ApiEnvelope<T>;

    if (this.isApiEnvelope<T>(payload)) {
      // Preferred contract: `{ success, data|error }` envelope from api-contract/http helpers.
      if (payload.success === false) {
        return {
          data: undefined,
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

/**
 * Utility reading the JWT Token generated by Auth.js/Magic Links cleanly
 * from universal LocalStorage keys. Allows ApiClient to run stateless.
 */
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
