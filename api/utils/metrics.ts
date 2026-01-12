/**
 * Metrics collection and reporting
 * Tracks performance metrics, errors, and business metrics
 */

import { logger } from './logger.js';

export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export interface Counter {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export interface Histogram {
  name: string;
  values: number[];
  tags?: Record<string, string>;
}

class MetricsCollector {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private metrics: Metric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Increment counter
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    const counter = this.counters.get(key) || { name, value: 0, tags };
    counter.value += value;
    this.counters.set(key, counter);
  }

  /**
   * Record histogram value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    const histogram = this.histograms.get(key) || { name, values: [], tags };
    histogram.values.push(value);
    
    // Keep only last 100 values per histogram
    if (histogram.values.length > 100) {
      histogram.values.shift();
    }
    
    this.histograms.set(key, histogram);
  }

  /**
   * Record metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log metric in production for external collection
    if (process.env.NODE_ENV === 'production') {
      logger.debug(`METRIC: ${name}=${value}`, { tags, timestamp: metric.timestamp });
    }
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getKey(name, tags);
    return this.counters.get(key)?.value || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, tags?: Record<string, string>): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getKey(name, tags);
    const histogram = this.histograms.get(key);
    if (!histogram || histogram.values.length === 0) {
      return null;
    }

    const sorted = [...histogram.values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sum / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  /**
   * Get all counters
   */
  getCounters(): Counter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Get all histograms
   */
  getHistograms(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.metrics = [];
  }

  /**
   * Generate cache key from name and tags
   */
  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}[${tagStr}]`;
  }
}

// Global metrics collector
const metrics = new MetricsCollector();

/**
 * Increment counter
 */
export function incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
  metrics.increment(name, value, tags);
}

/**
 * Record histogram value
 */
export function recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
  metrics.record(name, value, tags);
}

/**
 * Record metric
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  metrics.recordMetric(name, value, tags);
}

/**
 * Get metrics collector instance
 */
export function getMetrics(): MetricsCollector {
  return metrics;
}

/**
 * Track function execution time
 */
export async function trackExecutionTime<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    recordHistogram(`${name}.duration`, duration, tags);
    incrementCounter(`${name}.success`, 1, tags);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordHistogram(`${name}.duration`, duration, { ...tags, error: 'true' });
    incrementCounter(`${name}.error`, 1, tags);
    throw error;
  }
}

