/**
 * GET /api/init-db - Initialize database schema
 * Protected by DB_INIT_SECRET environment variable
 * 
 * Usage:
 *   GET /api/init-db?secret=YOUR_SECRET
 *   or
 *   POST /api/init-db with header: X-DB-Init-Secret: YOUR_SECRET
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDatabase } from '../repositories/database.js';
import { logger } from '../utils/logger.js';
import { validateEnv } from '../utils/env.js';

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
      logger.logApiError('init-db', new Error('DB_INIT_SECRET not configured'), {});
      return response.status(500).json({
        success: false,
        error: 'Database initialization is not configured. Please set DB_INIT_SECRET environment variable.',
      });
    }

    // Verify secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.logApiError('init-db', new Error('Invalid secret provided'), {
        hasSecret: !!providedSecret,
      });
      return response.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid secret.',
      });
    }

    logger.logApiRequest('init-db', { method: request.method });

    // Validate environment variables before initialization
    try {
      validateEnv();
    } catch (error) {
      logger.logApiError('init-db - env validation', error instanceof Error ? error : new Error(String(error)), {});
      return response.status(500).json({
        success: false,
        error: 'Environment validation failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize database
    await initDatabase();

    logger.logApiRequest('init-db', { 
      message: 'Database initialized successfully' 
    });

    return response.status(200).json({
      success: true,
      message: 'Database schema initialized successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.logApiError('init-db', error instanceof Error ? error : new Error(String(error)), {});
    
    return response.status(500).json({
      success: false,
      error: 'Failed to initialize database',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

