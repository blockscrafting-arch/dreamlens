/**
 * Health check endpoint
 * Provides system health status and metrics
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import { getMetrics } from '../utils/metrics.js';
import { getCircuitBreaker } from '../utils/circuit-breaker.js';
import { logger } from '../utils/logger.js';
import { successResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    circuitBreakers: Array<{
      name: string;
      state: string;
    }>;
  };
  metrics?: {
    counters: Array<{
      name: string;
      value: number;
    }>;
    histograms: Array<{
      name: string;
      stats: {
        count: number;
        avg: number;
        p95: number;
      };
    }>;
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);
    const includeMetrics = request.query.metrics === 'true';

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'unhealthy',
        },
        circuitBreakers: [],
      },
    };

    // Check database
    try {
      // First check if connection string is configured
      const hasPostgresUrl = !!process.env.POSTGRES_URL;
      const hasDatabaseUrl = !!process.env.DATABASE_URL;
      
      if (!hasPostgresUrl && !hasDatabaseUrl) {
        health.checks.database = {
          status: 'unhealthy',
          error: 'Database connection string not configured. Add POSTGRES_URL or DATABASE_URL to environment variables.',
        };
        health.status = 'unhealthy';
        logger.logApiError('Health check - Database', new Error('POSTGRES_URL or DATABASE_URL not configured'), {
          help: 'Add POSTGRES_URL to Vercel Dashboard → Settings → Environment Variables and redeploy',
        });
      } else {
        const dbStart = Date.now();
        await sql`SELECT 1 as health_check`;
        const dbResponseTime = Date.now() - dbStart;
        health.checks.database = {
          status: 'healthy',
          responseTime: dbResponseTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConnectionError = 
        errorMessage.includes('connection') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('getaddrinfo');
      
      let helpfulError = errorMessage;
      if (isConnectionError) {
        helpfulError = `Database connection failed: ${errorMessage}. Please check your POSTGRES_URL connection string and ensure the database is accessible.`;
      }
      
      health.checks.database = {
        status: 'unhealthy',
        error: helpfulError,
      };
      health.status = 'unhealthy';
      logger.logApiError('Health check - Database', error instanceof Error ? error : new Error(String(error)), {
        isConnectionError,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      });
    }

    // Check circuit breakers
    // Note: In a real implementation, you'd maintain a registry of all circuit breakers
    const geminiCircuitBreaker = getCircuitBreaker('gemini-api');
    health.checks.circuitBreakers.push({
      name: 'gemini-api',
      state: geminiCircuitBreaker.getState(),
    });

    // If any circuit breaker is open, mark as degraded
    if (health.checks.circuitBreakers.some(cb => cb.state === 'OPEN')) {
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }

    // Include metrics if requested
    if (includeMetrics) {
      const metrics = getMetrics();
      health.metrics = {
        counters: metrics.getCounters().map(c => ({
          name: c.name,
          value: c.value,
        })),
        histograms: metrics.getHistograms().map(h => {
          const stats = metrics.getHistogramStats(h.name, h.tags);
          return {
            name: h.name,
            stats: stats
              ? {
                  count: stats.count,
                  avg: stats.avg,
                  p95: stats.p95,
                }
              : {
                  count: 0,
                  avg: 0,
                  p95: 0,
                },
          };
        }),
      };
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return response.status(statusCode).json(
      successResponse(health, undefined, requestOrigin)
    );
  } catch (error) {
    logger.logApiError('Health check', error instanceof Error ? error : new Error(String(error)));
    return response.status(503).json({
      success: false,
      error: 'Health check failed',
      status: 'unhealthy',
    });
  }
}

