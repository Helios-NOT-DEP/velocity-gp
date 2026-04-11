/**
 * @file http.ts
 * @description Standardized HTTP Response Envelope utilities and type definitions.
 * All backend API responses across Velocity GP are expected to wrap their payloads inside
 * these standardized Success or Error envelopes. This guarantees predictable parsing
 * inside the frontend `api-client` package.
 */

/**
 * Metadata optionally attached to API responses to supply pagination, telemetry,
 * or tracking constraints.
 */
export interface ApiMeta {
  readonly requestId?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly total?: number;
}

/**
 * Generic envelope structure for all successful HTTP (2xx) responses.
 * Contains a typed `data` payload.
 */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: ApiMeta;
}

/**
 * Defined payload schema representing a predictable error payload.
 * Eliminates ad-hoc error structures from the backend.
 */
export interface ApiErrorShape {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Generic envelope structure for all failing HTTP (4xx, 5xx) responses.
 * Provides the context of the error instead of data.
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiErrorShape;
  readonly meta?: ApiMeta;
}

/**
 * A discriminated union mapping the full spectrum of possible API response envelopes.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Factory utility to construct a strictly-typed Success Response.
 * Used heavily by the API controllers when returning data.
 */
export function successResponse<T>(data: T, meta?: ApiMeta): ApiSuccessResponse<T> {
  // Keep envelope shape stable across endpoints and runtime implementations.
  return meta ? { success: true, data, meta } : { success: true, data };
}

/**
 * Factory utility to construct a strictly-typed Error Response.
 * Used safely within try/catch blocks and central error handling middleware.
 */
export function errorResponse(error: ApiErrorShape, meta?: ApiMeta): ApiErrorResponse {
  return meta ? { success: false, error, meta } : { success: false, error };
}
