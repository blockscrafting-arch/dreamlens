/**
 * CORS utility for API routes
 * Supports configurable allowed origins via environment variables
 */

/**
 * Get allowed origin for CORS
 * Checks if the request origin is in the allowed list
 */
export function getAllowedOrigin(requestOrigin?: string | null): string {
  // Get allowed origins from environment variable
  // Format: "https://example.com,https://www.example.com,http://localhost:3000"
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // If no origins configured
  if (allowedOrigins.length === 0) {
    // In development, allow localhost and all origins
    if (process.env.NODE_ENV === 'development') {
      return requestOrigin || '*';
    }
    // In production without configuration, log warning and deny all
    // This is a security measure - CORS must be explicitly configured
    if (process.env.NODE_ENV === 'production') {
      // Log warning but don't throw - allow empty string to deny CORS
      console.warn('[CORS] WARNING: No ALLOWED_ORIGINS configured in production. CORS requests will be denied.');
      return ''; // Empty string denies CORS
    }
    // Fallback for other environments
    return requestOrigin || '';
  }

  // Check if request origin is in allowed list
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // If origin not in list
  if (process.env.NODE_ENV === 'development') {
    // In development, allow all for easier testing
    return '*';
  }

  // In production, deny requests from unknown origins
  // Return empty string to deny CORS
  return '';
}

/**
 * Get CORS headers for API responses
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(requestOrigin);

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': allowedOrigin !== '*' ? 'true' : 'false',
  };
}

/**
 * Set CORS headers on the response object
 */
export function setCorsHeaders(response: any, requestOrigin?: string | null): void {
  const headers = getCorsHeaders(requestOrigin);
  Object.entries(headers).forEach(([key, value]) => {
    if (typeof response.setHeader === 'function') {
      response.setHeader(key, value);
    }
  });
}