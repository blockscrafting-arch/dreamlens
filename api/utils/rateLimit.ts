/**
 * Server-side rate limiting utilities
 */

import { sql } from '../repositories/database.js';
import { logger } from './logger.js';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

/**
 * Check rate limit for user
 * @param userId User ID
 * @param action Action type (e.g., 'generation', 'api_call')
 * @param limit Maximum requests allowed
 * @param windowMs Time window in milliseconds
 * @param ipAddress Client IP address (optional, for anonymous users)
 * @param authType Authentication type ('clerk', 'device', or 'telegram')
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number = 60000, // 1 minute default
  ipAddress?: string | null,
  authType?: 'clerk' | 'device' | 'telegram' | null
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowStart = new Date(now - windowMs);

    // Use a single query to check limit and potentially insert (if we want to be very atomic)
    // For Vercel Postgres, we can use a transaction or just accept a small race condition
    // given it's just rate limiting. But let's make it better by using user_id index properly.
    let result;
    if (authType === 'device' && ipAddress) {
      // Anonymous user: count by user_id OR ip_address
      result = await sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM usage_logs
        WHERE action = ${action}
          AND created_at >= ${windowStart.toISOString()}
          AND (user_id = ${userId} OR ip_address = ${ipAddress})
      `;
    } else {
      // Authenticated user: count only by user_id
      result = await sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM usage_logs
        WHERE user_id = ${userId}
          AND action = ${action}
          AND created_at >= ${windowStart.toISOString()}
      `;
    }

    const count = parseInt(result.rows[0]?.count || '0', 10);
    const remaining = Math.max(0, limit - count);
    const allowed = count < limit;

    // Calculate reset time
    const resetTime = now + windowMs;

    if (!allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        error: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`,
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime,
    };
  } catch (error) {
    logger.error('Rate limit check error', error instanceof Error ? error : new Error(String(error)), {
      userId,
      action,
      ipAddress: ipAddress?.substring(0, 15) + '...',
      authType,
    });
    
    // In production, fail closed (deny request) to prevent abuse
    // In development, fail open (allow request) for easier testing
    if (process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + windowMs,
        error: 'Rate limit service unavailable. Please try again later.',
      };
    }
    
    // In development, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + windowMs,
    };
  }
}

/**
 * Record API usage
 * @param userId User ID
 * @param action Action type (e.g., 'generation', 'download')
 * @param ipAddress Client IP address (optional)
 */
export async function recordUsage(
  userId: string,
  action: string,
  ipAddress?: string | null
): Promise<void> {
  try {
    await sql`
      INSERT INTO usage_logs (user_id, action, ip_address)
      VALUES (${userId}, ${action}, ${ipAddress || null})
    `;
  } catch (error) {
    logger.warn('Error recording usage', {
      userId,
      action,
      ipAddress: ipAddress?.substring(0, 15) + '...',
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - usage logging is not critical
  }
}


