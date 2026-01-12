/**
 * Unit tests for circuit breaker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState, getCircuitBreaker } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute function successfully in CLOSED state', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    
    const result = await circuitBreaker.execute(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open circuit after failure threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('service down'));
    
    // First 3 failures should open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    
    // Next call should fail immediately without calling function
    await expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn).toHaveBeenCalledTimes(3); // Only 3 calls, 4th was rejected
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    vi.useFakeTimers();
    
    const fn = vi.fn().mockRejectedValue(new Error('service down'));
    
    // Open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    
    // Advance time past timeout
    vi.advanceTimersByTime(1100);
    
    // Next call should transition to HALF_OPEN
    try {
      await circuitBreaker.execute(fn);
    } catch (error) {
      // Expected
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    
    vi.useRealTimers();
  });

  it('should close circuit after success threshold in HALF_OPEN', async () => {
    vi.useFakeTimers();
    
    const failFn = vi.fn().mockRejectedValue(new Error('service down'));
    const successFn = vi.fn().mockResolvedValue('success');
    
    // Open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failFn);
      } catch (error) {
        // Expected
      }
    }
    
    // Advance time past timeout
    vi.advanceTimersByTime(1100);
    
    // Successfully execute 2 times to close circuit
    await circuitBreaker.execute(successFn);
    await circuitBreaker.execute(successFn);
    
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    
    vi.useRealTimers();
  });
});

describe('getCircuitBreaker', () => {
  it('should return same instance for same name', () => {
    const cb1 = getCircuitBreaker('test');
    const cb2 = getCircuitBreaker('test');
    
    expect(cb1).toBe(cb2);
  });

  it('should return different instances for different names', () => {
    const cb1 = getCircuitBreaker('test1');
    const cb2 = getCircuitBreaker('test2');
    
    expect(cb1).not.toBe(cb2);
  });
});

