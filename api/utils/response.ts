/**
 * Standardized API response utilities
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  waitTime?: number; // For rate limits
}

/**
 * Create success response body
 * Note: CORS headers should be set by middleware or manually
 */
export function successResponse<T>(
  data: T,
  message?: string,
  _requestOrigin?: string | null,
  _headers?: Record<string, string>
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Create error response body
 * Note: CORS headers should be set by middleware or manually
 */
export function errorResponse(
  error: string,
  _status: number = 400,
  message?: string,
  _requestOrigin?: string | null,
  _headers?: Record<string, string>
): ApiResponse {
  return {
    success: false,
    error,
    message,
  };
}

export function unauthorizedResponse(_requestOrigin?: string | null): ApiResponse {
  return errorResponse('Unauthorized', 401, 'Authentication required', _requestOrigin);
}

export function forbiddenResponse(_requestOrigin?: string | null): ApiResponse {
  return errorResponse('Forbidden', 403, 'Insufficient permissions', _requestOrigin);
}

export function notFoundResponse(_requestOrigin?: string | null): ApiResponse {
  return errorResponse('Not Found', 404, 'Resource not found', _requestOrigin);
}

export function rateLimitResponse(waitTime?: number, _requestOrigin?: string | null): ApiResponse {
  return {
    success: false,
    error: 'Rate limit exceeded',
    message: waitTime ? `Please wait ${waitTime} seconds` : 'Too many requests',
    waitTime,
  };
}
