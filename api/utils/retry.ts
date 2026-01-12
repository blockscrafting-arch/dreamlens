/**
 * Retry utilities with exponential backoff
 * Provides robust retry mechanisms for transient failures
 */

import { logger } from './logger.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'retryable' | 'onRetry'>>): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, retryable?: (error: unknown) => boolean): boolean {
  if (retryable) {
    return retryable(error);
  }

  // Default: retry on network errors, timeouts, and 5xx errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      return true;
    }
  }

  // Check for HTTP status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status >= 500 && status < 600) {
      return true;
    }
  }

  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<Omit<RetryOptions, 'retryable' | 'onRetry'>> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, options.retryable)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Call onRetry callback
      if (options.onRetry) {
        options.onRetry(attempt, error);
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      logger.debug(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`, {
        attempt,
        maxAttempts: opts.maxAttempts,
        delay,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  // All retries exhausted
  logger.error(`All retry attempts exhausted`, lastError instanceof Error ? lastError : new Error(String(lastError)), {
    maxAttempts: opts.maxAttempts,
  });

  throw lastError;
}

/**
 * Retry with custom retryable check
 */
export function withRetryIf<T>(
  fn: () => Promise<T>,
  retryable: (error: unknown) => boolean,
  options: Omit<RetryOptions, 'retryable'> = {}
): Promise<T> {
  return withRetry(fn, { ...options, retryable });
}

