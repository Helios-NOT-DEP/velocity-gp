/**
 * API Services
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { ApiClient } from '@velocity-gp/api-client';

import { withTelemetrySpan } from '@/services/observability';

export { ApiClient };
export type { ApiRequestOptions, ApiResponse } from '@velocity-gp/api-client';
export * from '@velocity-gp/api-contract';

class ObservableApiClient extends ApiClient {
  override async request<T>(endpoint: string, options: Parameters<ApiClient['request']>[1] = {}) {
    return withTelemetrySpan(
      'api.request',
      {
        attributes: {
          'app.api.endpoint': endpoint,
          'http.method': options.method || 'GET',
        },
      },
      async (span) => {
        const response = await super.request<T>(endpoint, options);
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
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
);
