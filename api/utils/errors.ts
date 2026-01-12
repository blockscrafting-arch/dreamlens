/**
 * Error handling utilities for API routes
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends ApiError {
  public waitTime?: number;
  
  constructor(message: string = 'Rate limit exceeded', waitTime?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    this.waitTime = waitTime;
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Safely extract error code from unknown error type
 */
export function getErrorCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return typeof error.code === 'number' ? error.code : undefined;
  }
  return undefined;
}

/**
 * Check if error has status property (for HTTP errors)
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return typeof error.status === 'number' ? error.status : undefined;
  }
  return undefined;
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  
  // HTTP status codes that are retryable
  if (status) {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }
  
  // Error codes that are retryable
  if (code) {
    const codeStr = String(code);
    return codeStr === 'ECONNRESET' || codeStr === 'ETIMEDOUT' || codeStr === 'ENOTFOUND';
  }
  
  // Check error message for retryable patterns
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('timeout') || 
         message.includes('network') || 
         message.includes('connection') ||
         message.includes('rate limit') ||
         message.includes('quota');
}

/**
 * Enhanced error context for better debugging
 */
export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Create error with context
 */
export class ContextualError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'ContextualError';
    this.context = {
      ...context,
      timestamp: context.timestamp || Date.now(),
    };
    this.originalError = originalError;
    
    // Preserve stack trace
    if (originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
      stack: this.stack,
    };
  }
}

/**
 * Wrap error with context
 */
export function wrapError(error: unknown, context: ErrorContext): ContextualError {
  const message = getErrorMessage(error);
  const originalError = error instanceof Error ? error : new Error(String(error));
  
  return new ContextualError(message, context, originalError);
}

/**
 * Check if error is a ContextualError
 */
export function isContextualError(error: unknown): error is ContextualError {
  return error instanceof ContextualError;
}


