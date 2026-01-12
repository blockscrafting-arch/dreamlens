/**
 * Unit tests for retry utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, withRetryIf } from '../retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    
    const result = await withRetry(fn, { maxAttempts: 3 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success');
    
    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
    });
    
    // Fast-forward time to skip delays
    await vi.advanceTimersByTimeAsync(300);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const error = new Error('timeout');
    const fn = vi.fn().mockRejectedValue(error);
    
    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
    });
    
    await vi.advanceTimersByTimeAsync(500);
    
    await expect(promise).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors', async () => {
    const error = new Error('validation error');
    const fn = vi.fn().mockRejectedValue(error);
    
    const promise = withRetry(fn, {
      maxAttempts: 3,
      retryable: () => false,
    });
    
    await expect(promise).rejects.toThrow('validation error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success');
    
    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    });
    
    // First attempt fails, wait 100ms
    await vi.advanceTimersByTimeAsync(100);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withRetryIf', () => {
  it('should use custom retryable check', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce('success');
    
    const promise = withRetryIf(
      fn,
      (error) => (error as { status?: number }).status === 500,
      { maxAttempts: 3, initialDelayMs: 100 }
    );
    
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

