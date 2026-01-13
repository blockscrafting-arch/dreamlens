/**
 * In-memory LRU cache with TTL support and size limit
 * For serverless environments, consider using Redis for distributed caching
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * LRU cache with TTL and maximum size limit
 * When cache exceeds maxSize, oldest entries are evicted
 */
class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number;
  private maxSize: number;

  constructor(defaultTtlMs: number = 60000, maxSize: number = 1000) {
    this.defaultTtl = defaultTtlMs;
    this.maxSize = maxSize;
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value from cache (moves entry to end for LRU)
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // LRU: Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  /**
   * Set value in cache with LRU eviction
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtl;

    // If key exists, delete it first (to update position for LRU)
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      } else {
        break;
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache size
   */
  size(): number {
    this.cleanup();
    return this.store.size;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global cache instance with 1 minute TTL and 1000 max entries
const cache = new Cache(60000, 1000);

/**
 * Cache decorator for async functions
 */
export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string,
  ttlMs?: number
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = keyGenerator
      ? keyGenerator(...args)
      : `cache_${fn.name}_${JSON.stringify(args)}`;

    // Try to get from cache
    const cached = cache.get<Awaited<ReturnType<T>>>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    cache.set(key, result, ttlMs);
    return result as Awaited<ReturnType<T>>;
  }) as T;
}

/**
 * Get cache instance (for manual operations)
 */
export function getCache(): Cache {
  return cache;
}

/**
 * Generate cache key from parts
 */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

