/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by stopping requests when service is down
 */

import { logger } from './logger.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  successThreshold?: number; // Number of successes before closing circuit
  timeout?: number; // Time in ms before attempting to close circuit (half-open state)
  resetTimeout?: number; // Time in ms before resetting failure count
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 300000, // 5 minutes
};

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, requests fail immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: Required<CircuitBreakerOptions>;
  private name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition
    this.updateState();

    // If circuit is open, reject immediately
    if (this.state.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.state.nextAttemptTime && now < this.state.nextAttemptTime) {
        const waitTime = Math.ceil((this.state.nextAttemptTime - now) / 1000);
        logger.warn(`Circuit breaker ${this.name} is OPEN. Rejecting request.`, {
          circuitName: this.name,
          state: this.state.state,
          waitTimeSeconds: waitTime,
        });
        throw new Error(`Circuit breaker is OPEN. Service unavailable. Retry after ${waitTime}s`);
      } else {
        // Transition to half-open
        this.state.state = CircuitState.HALF_OPEN;
        this.state.successCount = 0;
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, {
          circuitName: this.name,
        });
      }
    }

    // Execute function
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Update circuit state based on time and thresholds
   */
  private updateState(): void {
    const now = Date.now();

    // Reset failure count if reset timeout has passed
    if (
      this.state.lastFailureTime &&
      now - this.state.lastFailureTime > this.options.resetTimeout
    ) {
      this.state.failureCount = 0;
      this.state.lastFailureTime = null;
    }

    // If circuit is open and timeout has passed, transition to half-open
    if (
      this.state.state === CircuitState.OPEN &&
      this.state.nextAttemptTime &&
      now >= this.state.nextAttemptTime
    ) {
      this.state.state = CircuitState.HALF_OPEN;
      this.state.successCount = 0;
      logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, {
        circuitName: this.name,
      });
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state.state === CircuitState.HALF_OPEN) {
      this.state.successCount++;
      if (this.state.successCount >= this.options.successThreshold) {
        // Close circuit
        this.state.state = CircuitState.CLOSED;
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.state.nextAttemptTime = null;
        logger.info(`Circuit breaker ${this.name} CLOSED after successful recovery`, {
          circuitName: this.name,
        });
      }
    } else {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === CircuitState.HALF_OPEN) {
      // Immediately open circuit on failure in half-open state
      this.state.state = CircuitState.OPEN;
      this.state.nextAttemptTime = Date.now() + this.options.timeout;
      logger.warn(`Circuit breaker ${this.name} OPENED after failure in HALF_OPEN state`, {
        circuitName: this.name,
        failureCount: this.state.failureCount,
      });
    } else if (this.state.failureCount >= this.options.failureThreshold) {
      // Open circuit
      this.state.state = CircuitState.OPEN;
      this.state.nextAttemptTime = Date.now() + this.options.timeout;
      logger.error(`Circuit breaker ${this.name} OPENED`, undefined, {
        circuitName: this.name,
        failureCount: this.state.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state.state;
  }

  /**
   * Reset circuit breaker (for testing/manual intervention)
   */
  reset(): void {
    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
    };
    logger.info(`Circuit breaker ${this.name} manually reset`, {
      circuitName: this.name,
    });
  }
}

/**
 * Global circuit breakers registry
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name)!;
}

