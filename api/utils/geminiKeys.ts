/**
 * Utility for managing Gemini API keys with fallback support
 */

import { logger } from './logger.js';
import { validateEnvLazy } from './env.js';
import { getErrorMessage, getErrorStatus, getErrorCode } from './errors.js';
import { getCircuitBreaker } from './circuit-breaker.js';
import { trackExecutionTime } from './metrics.js';

/**
 * Get available Gemini API keys from environment variables
 * Returns array with primary key first, backup key second (if available)
 * Automatically validates environment variables on first call
 */
export function getGeminiApiKeys(): string[] {
  // Validate env variables lazily
  try {
    validateEnvLazy();
  } catch (error) {
    // Log error but don't throw - let the caller handle it
    logger.error('Environment validation failed in getGeminiApiKeys', error instanceof Error ? error : new Error(String(error)));
  }
  
  const primary = process.env.GEMINI_API_KEY;
  const backup = process.env.GEMINI_API_KEY_BACKUP;

  const keys: string[] = [];
  
  if (primary) {
    keys.push(primary);
  }
  
  if (backup) {
    keys.push(backup);
  }

  return keys;
}

/**
 * Check if an error is retryable (should trigger fallback to backup key)
 * 
 * Retryable errors:
 * - HTTP 429 (rate limit/quota exceeded)
 * - HTTP 5xx (server errors)
 * - Network errors (timeout, connection errors)
 * - General API errors without specific code
 * 
 * NOT retryable:
 * - Safety filter errors (finishReason === 'SAFETY')
 * - Validation errors (400 Bad Request for wrong data)
 * - Missing image errors (if not related to API)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();
  const errorObj = error && typeof error === 'object' ? error as Record<string, unknown> : null;

  // HTTP 429 - rate limit/quota exceeded
  if (status === 429 || message.includes('429') || message.includes('quota')) {
    return true;
  }

  // HTTP 5xx - server errors
  if (status && status >= 500 && status < 600) {
    return true;
  }

  // Network errors
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('network') ||
    message.includes('connection')
  ) {
    return true;
  }

  // Safety filter - NOT retryable
  const finishReason = errorObj?.finishReason;
  if (
    message.includes('safety') ||
    finishReason === 'SAFETY' ||
    message.includes('safety filter')
  ) {
    return false;
  }

  // Validation errors (400) - NOT retryable
  if (status === 400 && (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('bad request')
  )) {
    return false;
  }

  // If it's an Error object but not a known non-retryable error, consider it retryable
  // This covers general API errors from Gemini
  if (error instanceof Error) {
    // Check if it's a known non-retryable error
    if (
      message.includes('недостаточно изображений') ||
      message.includes('api ключ не найден') ||
      message.includes('невалиден')
    ) {
      return false;
    }
    // Otherwise, treat as retryable
    return true;
  }

  // Unknown errors - treat as retryable to be safe
  return true;
}

/**
 * Execute a function with automatic fallback to backup API key on retryable errors
 * 
 * @param fn Function that takes an API key and returns a Promise
 * @param context Optional context for logging
 * @returns Result from the function
 * @throws Error if all keys fail or if error is not retryable
 */
export async function tryWithFallback<T>(
  fn: (apiKey: string) => Promise<T>,
  context?: { operation?: string; [key: string]: unknown }
): Promise<T> {
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const operation = context?.operation || 'gemini-api-call';
  const circuitBreaker = getCircuitBreaker('gemini-api');
  
  return trackExecutionTime('gemini.api_call', async () => {
    let lastError: Error | undefined = undefined;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const isPrimary = i === 0;
      const keyLabel = isPrimary ? 'primary' : 'backup';

      try {
        logger.debug(`Attempting ${operation} with ${keyLabel} key`, {
          ...context,
          keyIndex: i,
          keyLabel,
        });

        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(async () => {
          return await fn(key);
        });

        // If we used backup key, log it for monitoring
        if (!isPrimary) {
          logger.info(`Successfully used backup key for ${operation}`, {
            ...context,
            keyLabel,
          });
        }

        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!isRetryableError(error)) {
          // Not retryable - throw immediately
          const errorMsg = getErrorMessage(error);
          logger.debug(`Non-retryable error with ${keyLabel} key`, {
            ...context,
            keyLabel,
            error: errorMsg,
          });
          throw error;
        }

        // Retryable error - log and try next key if available
        const errorMsg = getErrorMessage(error);
        const errorStatus = getErrorStatus(error);
        const errorCode = getErrorCode(error);
        logger.warn(`Retryable error with ${keyLabel} key, ${keys.length - i - 1 > 0 ? 'switching to backup' : 'no more keys available'}`, {
          ...context,
          keyLabel,
          error: errorMsg,
          errorCode: errorCode || errorStatus,
          remainingKeys: keys.length - i - 1,
        });

        // If this was the last key, break and throw
        if (i === keys.length - 1) {
          break;
        }

        // Otherwise, continue to next key
        logger.info(`Switching to backup key for ${operation}`, {
          ...context,
          previousKey: keyLabel,
        });
      }
    }

    // All keys failed
    const finalError = lastError || new Error(`Failed to execute ${operation} with all available keys`);
    logger.error(`All API keys exhausted for ${operation}`, finalError, {
      ...context,
      totalKeys: keys.length,
    });

    throw finalError;
  }, { operation });
}

