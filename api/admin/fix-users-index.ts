/**
 * POST /api/admin/fix-users-index - Fix unique index for telegram_id
 * Protected by DB_INIT_SECRET environment variable
 * 
 * This endpoint fixes the unique index for telegram_id column to support ON CONFLICT
 * 
 * Usage:
 *   POST /api/admin/fix-users-index?secret=YOUR_SECRET
 *   or
 *   POST /api/admin/fix-users-index
 *   Header: X-DB-Init-Secret: YOUR_SECRET
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import { logger } from '../utils/logger.js';

interface FixResult {
  success: boolean;
  timestamp: string;
  applied: string[];
  errors: Array<{ step: string; error: string }>;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    // Get secret from query parameter or header
    const secretFromQuery = typeof request.query.secret === 'string' ? request.query.secret : null;
    const secretFromHeader = request.headers['x-db-init-secret'] as string | undefined;
    const providedSecret = secretFromQuery || secretFromHeader;

    // Get expected secret from environment
    const expectedSecret = process.env.DB_INIT_SECRET;

    // Check if secret is configured
    if (!expectedSecret) {
      logger.logApiError('fix-users-index', new Error('DB_INIT_SECRET not configured'), {});
      return response.status(500).json({
        success: false,
        error: 'Database fix is not configured. Please set DB_INIT_SECRET environment variable.',
      });
    }

    // Verify secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.logApiError('fix-users-index', new Error('Invalid secret provided'), {
        hasSecret: !!providedSecret,
      });
      return response.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid secret.',
      });
    }

    logger.logApiRequest('fix-users-index', { method: request.method });

    const result: FixResult = {
      success: true,
      timestamp: new Date().toISOString(),
      applied: [],
      errors: [],
    };

    // Step 0: Deduplicate users (keep most recent)
    try {
      await sql`
        DELETE FROM users
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY telegram_id ORDER BY updated_at DESC) AS rnum
            FROM users
            WHERE telegram_id IS NOT NULL
          ) t
          WHERE t.rnum > 1
        );
      `;
      result.applied.push('Deduplicated users with duplicate telegram_id');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ step: 'Deduplication', error: errorMessage });
      logger.logApiError('fix-users-index-deduplication', error instanceof Error ? error : new Error(String(error)));
    }

    // Step 1: Drop existing indexes/constraints for telegram_id
    try {
      // Drop partial unique index if exists
      await sql`
        DROP INDEX IF EXISTS idx_users_telegram_id;
      `;
      result.applied.push('Dropped existing idx_users_telegram_id index');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Ignore if index doesn't exist
      if (!errorMessage.includes('does not exist')) {
        result.errors.push({ step: 'Drop existing index', error: errorMessage });
        logger.logApiError('fix-users-index-drop', error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Step 2: Drop UNIQUE constraint if exists (from CREATE TABLE)
    try {
      await sql`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_telegram_id_key;
      `;
      result.applied.push('Dropped existing users_telegram_id_key constraint (if existed)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Ignore if constraint doesn't exist
      if (!errorMessage.includes('does not exist')) {
        result.errors.push({ step: 'Drop existing constraint', error: errorMessage });
        logger.logApiError('fix-users-index-constraint', error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Step 3: Create proper UNIQUE constraint/index
    // PostgreSQL allows multiple NULLs in UNIQUE indexes, which is what we need
    // This will work with ON CONFLICT (telegram_id) in INSERT statements
    try {
      // First, try to add UNIQUE constraint directly (simpler and works with ON CONFLICT)
      await sql`
        ALTER TABLE users 
        ADD CONSTRAINT users_telegram_id_unique 
        UNIQUE (telegram_id);
      `;
      result.applied.push('Created UNIQUE constraint users_telegram_id_unique on telegram_id');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If constraint already exists, that's fine
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        result.applied.push('UNIQUE constraint already exists on telegram_id');
      } else {
        // If constraint creation fails, try creating UNIQUE index instead
        try {
          await sql`
            CREATE UNIQUE INDEX users_telegram_id_unique 
            ON users(telegram_id);
          `;
          result.applied.push('Created UNIQUE index users_telegram_id_unique on telegram_id');
        } catch (indexError) {
          const indexErrorMessage = indexError instanceof Error ? indexError.message : String(indexError);
          result.errors.push({ step: 'Create UNIQUE constraint/index', error: `${errorMessage}; Index error: ${indexErrorMessage}` });
          result.success = false;
          logger.logApiError('fix-users-index-create', indexError instanceof Error ? indexError : new Error(String(indexError)));
        }
      }
    }

    // Step 4: Verify the index was created
    try {
      const indexInfo = await sql<{ indexname: string; indexdef: string }>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND indexname LIKE '%telegram%'
      `;

      if (indexInfo.rows.length > 0) {
        const indexes = indexInfo.rows.map(row => ({
          name: row.indexname,
          definition: row.indexdef,
        }));
        result.applied.push(`Verified: Found ${indexes.length} telegram_id index(es): ${indexes.map(i => i.name).join(', ')}`);
      } else {
        result.errors.push({ step: 'Verification', error: 'No telegram_id index found after creation' });
        result.success = false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ step: 'Verification', error: errorMessage });
      logger.logApiError('fix-users-index-verify', error instanceof Error ? error : new Error(String(error)));
    }

    if (result.errors.length > 0) {
      logger.logApiError('fix-users-index', new Error('Index fix completed with errors'), {
        errorsCount: result.errors.length,
        appliedCount: result.applied.length,
      });
    } else {
      logger.logApiInfo('fix-users-index', {
        message: 'Index fix completed successfully',
        appliedCount: result.applied.length,
      });
    }

    return response.status(result.success ? 200 : 207).json(result);
  } catch (error) {
    logger.logApiError('fix-users-index', error instanceof Error ? error : new Error(String(error)), {});
    
    return response.status(500).json({
      success: false,
      error: 'Failed to fix users index',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
