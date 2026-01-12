/**
 * POST /api/admin/cleanup-users - Delete all anonymous users
 * Protected by DB_INIT_SECRET environment variable
 * 
 * This endpoint deletes all users where clerk_id IS NULL (anonymous users).
 * Related data (tokens, transactions, generations, etc.) will be automatically
 * deleted via CASCADE foreign key constraints.
 * 
 * Usage:
 *   POST /api/admin/cleanup-users
 *   Header: X-DB-Init-Secret: YOUR_SECRET
 *   or
 *   POST /api/admin/cleanup-users?secret=YOUR_SECRET
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import { logger } from '../utils/logger.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    // Only allow POST method
    if (request.method !== 'POST') {
      return response.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST.',
      });
    }

    // Get secret from query parameter or header
    const secretFromQuery = typeof request.query.secret === 'string' ? request.query.secret : null;
    const secretFromHeader = request.headers['x-db-init-secret'] as string | undefined;
    const providedSecret = secretFromQuery || secretFromHeader;

    // Get expected secret from environment
    const expectedSecret = process.env.DB_INIT_SECRET;

    // Check if secret is configured
    if (!expectedSecret) {
      logger.logApiError('cleanup-users', new Error('DB_INIT_SECRET not configured'), {});
      return response.status(500).json({
        success: false,
        error: 'Database cleanup is not configured. Please set DB_INIT_SECRET environment variable.',
      });
    }

    // Verify secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.logApiError('cleanup-users', new Error('Invalid secret provided'), {
        hasSecret: !!providedSecret,
      });
      return response.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid secret.',
      });
    }

    logger.logApiRequest('cleanup-users', { method: request.method });

    // Count anonymous users before deletion
    const countResult = await sql<{ count: string }>`
      SELECT COUNT(*) as count
      FROM users
      WHERE clerk_id IS NULL
    `;
    const countBefore = parseInt(countResult.rows[0]?.count || '0', 10);

    if (countBefore === 0) {
      logger.logApiInfo('cleanup-users', { message: 'No anonymous users to delete' });
      return response.status(200).json({
        success: true,
        message: 'No anonymous users found to delete',
        deletedCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Delete all anonymous users (clerk_id IS NULL)
    // CASCADE will automatically delete related records in:
    // - user_tokens
    // - token_transactions
    // - generations
    // - usage_logs
    // - payments
    // - subscriptions
    await sql`
      DELETE FROM users
      WHERE clerk_id IS NULL
    `;

    logger.logApiInfo('cleanup-users', {
      message: 'Anonymous users deleted successfully',
      deletedCount: countBefore,
    });

    return response.status(200).json({
      success: true,
      message: `Successfully deleted ${countBefore} anonymous user(s) and all related data`,
      deletedCount: countBefore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.logApiError('cleanup-users', error instanceof Error ? error : new Error(String(error)), {});
    
    return response.status(500).json({
      success: false,
      error: 'Failed to cleanup anonymous users',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

