/**
 * POST /api/admin/fix-generations-schema - Fix generations table schema
 * Protected by DB_INIT_SECRET environment variable
 * 
 * This endpoint fixes the generations table by making image_url nullable
 * (required for async generation workflow where image_url is set later)
 * 
 * Usage:
 *   POST /api/admin/fix-generations-schema?secret=YOUR_SECRET
 *   or
 *   POST /api/admin/fix-generations-schema
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
      logger.logApiError('fix-generations-schema', new Error('DB_INIT_SECRET not configured'), {});
      return response.status(500).json({
        success: false,
        error: 'Database fix is not configured. Please set DB_INIT_SECRET environment variable.',
      });
    }

    // Verify secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.logApiError('fix-generations-schema', new Error('Invalid secret provided'), {
        hasSecret: !!providedSecret,
      });
      return response.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid secret.',
      });
    }

    logger.logApiRequest('fix-generations-schema', { method: request.method });

    const result: FixResult = {
      success: true,
      timestamp: new Date().toISOString(),
      applied: [],
      errors: [],
    };

    // Step 1: Directly drop NOT NULL constraint (PostgreSQL doesn't store NOT NULL as named constraint)
    // We'll try to drop it and handle errors gracefully
    try {
      await sql`
        ALTER TABLE generations 
        ALTER COLUMN image_url DROP NOT NULL;
      `;
      result.applied.push('Removed NOT NULL constraint from image_url');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If column is already nullable, PostgreSQL will throw an error
      if (errorMessage.includes('does not exist') || 
          errorMessage.includes('column') && errorMessage.includes('not null')) {
        result.applied.push('image_url already nullable (NOT NULL constraint does not exist)');
      } else {
        result.errors.push({ step: 'Drop NOT NULL constraint', error: errorMessage });
        result.success = false;
        logger.logApiError('fix-generations-schema-drop-not-null', error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Step 3: Ensure image_url column type is TEXT (nullable)
    try {
      await sql`
        ALTER TABLE generations 
        ALTER COLUMN image_url TYPE TEXT;
      `;
      result.applied.push('Ensured image_url is TEXT type');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ step: 'Set image_url type to TEXT', error: errorMessage });
      logger.logApiError('fix-generations-schema-type', error instanceof Error ? error : new Error(String(error)));
      // Don't mark as failed if column already exists with correct type
      if (!errorMessage.includes('already') && !errorMessage.includes('does not exist')) {
        result.success = false;
      }
    }

    // Step 4: Verify the fix
    try {
      const columnInfo = await sql<{ is_nullable: string; data_type: string }>`
        SELECT is_nullable, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'generations'
          AND column_name = 'image_url'
      `;

      if (columnInfo.rows.length > 0) {
        const column = columnInfo.rows[0];
        if (column.is_nullable === 'YES') {
          result.applied.push(`Verified: image_url is nullable (${column.data_type})`);
        } else {
          result.errors.push({ 
            step: 'Verification', 
            error: `image_url is still NOT NULL (type: ${column.data_type})` 
          });
          result.success = false;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ step: 'Verification', error: errorMessage });
      logger.logApiError('fix-generations-schema-verify', error instanceof Error ? error : new Error(String(error)));
    }

    if (result.errors.length > 0) {
      logger.logApiError('fix-generations-schema', new Error('Schema fix completed with errors'), {
        errorsCount: result.errors.length,
        appliedCount: result.applied.length,
      });
    } else {
      logger.logApiInfo('fix-generations-schema', {
        message: 'Schema fix completed successfully',
        appliedCount: result.applied.length,
      });
    }

    return response.status(result.success ? 200 : 207).json(result);
  } catch (error) {
    logger.logApiError('fix-generations-schema', error instanceof Error ? error : new Error(String(error)), {});
    
    return response.status(500).json({
      success: false,
      error: 'Failed to fix database schema',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
