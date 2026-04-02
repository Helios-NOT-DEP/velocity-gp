export interface ApiMeta {
  readonly requestId?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly total?: number;
}

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: ApiMeta;
}

export interface ApiErrorShape {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiErrorShape;
  readonly meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(data: T, meta?: ApiMeta): ApiSuccessResponse<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function errorResponse(error: ApiErrorShape, meta?: ApiMeta): ApiErrorResponse {
  return meta ? { success: false, error, meta } : { success: false, error };
}
