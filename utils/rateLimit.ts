/**
 * Rate limiting utilities for client-side request throttling
 */

interface RateLimitState {
  lastRequestTime: number;
  requestCount: number;
  resetTime: number;
}

const RATE_LIMIT_CONFIG = {
  maxRequests: 3, // Maximum requests
  windowMs: 60000, // 1 minute window
  cooldownMs: 2000, // Minimum time between requests (2 seconds)
};

class RateLimiter {
  private state: RateLimitState = {
    lastRequestTime: 0,
    requestCount: 0,
    resetTime: Date.now() + RATE_LIMIT_CONFIG.windowMs,
  };

  /**
   * Check if a request can be made
   */
  canMakeRequest(): { allowed: boolean; waitTime?: number; reason?: string } {
    const now = Date.now();

    // Reset counter if window has passed
    if (now > this.state.resetTime) {
      this.state.requestCount = 0;
      this.state.resetTime = now + RATE_LIMIT_CONFIG.windowMs;
    }

    // Check cooldown period
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.cooldownMs) {
      const waitTime = RATE_LIMIT_CONFIG.cooldownMs - timeSinceLastRequest;
      return {
        allowed: false,
        waitTime: Math.ceil(waitTime / 1000), // Return in seconds
        reason: `Подождите ${Math.ceil(waitTime / 1000)} секунд перед следующим запросом`,
      };
    }

    // Check request limit
    if (this.state.requestCount >= RATE_LIMIT_CONFIG.maxRequests) {
      const waitTime = Math.ceil((this.state.resetTime - now) / 1000);
      return {
        allowed: false,
        waitTime,
        reason: `Превышен лимит запросов. Подождите ${waitTime} секунд`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.state.lastRequestTime = Date.now();
    this.state.requestCount++;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.state = {
      lastRequestTime: 0,
      requestCount: 0,
      resetTime: Date.now() + RATE_LIMIT_CONFIG.windowMs,
    };
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(): number {
    const now = Date.now();
    if (now > this.state.resetTime) {
      return RATE_LIMIT_CONFIG.maxRequests;
    }
    return Math.max(0, RATE_LIMIT_CONFIG.maxRequests - this.state.requestCount);
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Debounce function to delay execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}


