/**
 * API Services
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { ApiClient } from '@velocity-gp/api-client';

import { withTelemetrySpan } from '@/services/observability';
import { AUTH_SESSION_STORAGE_KEY, type AuthRole } from '@/services/auth/authTypes';

export { ApiClient };
export type { ApiRequestOptions, ApiResponse } from '@velocity-gp/api-client';
export * from '@velocity-gp/api-contract';

interface StoredAuthSession {
  readonly userId: string | null;
  readonly role: AuthRole;
  readonly isAuthenticated: boolean;
}

function resolveAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!rawSession) {
      return {};
    }

    const parsed = JSON.parse(rawSession) as Partial<StoredAuthSession>;
    if (
      !parsed.isAuthenticated ||
      typeof parsed.userId !== 'string' ||
      !parsed.userId ||
      !isAuthRole(parsed.role)
    ) {
      return {};
    }

    return {
      'x-user-id': parsed.userId,
      'x-user-role': parsed.role,
    };
  } catch {
    return {};
  }
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'admin' || value === 'helios' || value === 'player';
}

class ObservableApiClient extends ApiClient {
  override async request<T>(endpoint: string, options: Parameters<ApiClient['request']>[1] = {}) {
    const authHeaders = resolveAuthHeaders();
    const requestOptions = {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...authHeaders,
      },
    };

    return withTelemetrySpan(
      'api.request',
      {
        attributes: {
          'app.api.endpoint': endpoint,
          'http.method': requestOptions.method || 'GET',
        },
      },
      async (span) => {
        const response = await super.request<T>(endpoint, requestOptions);
        span?.setAttribute('http.response.status_code', response.status);

        if (!response.ok) {
          span?.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Request failed with status ${response.status}`,
          });
        }

        return response;
      }
    );
  }
}

export const apiClient = new ObservableApiClient(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
);
