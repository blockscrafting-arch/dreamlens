/**
 * POST /api/admin/migrate-hotfix - Create user_uploads table if it doesn't exist
 * This is a hotfix endpoint to create the user_uploads table that might be missing
 * from the database after deployment.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import { logger } from '../utils/logger.js';
import { setCorsHeaders } from '../utils/cors.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logger.logApiInfo('migrate-hotfix', { operation: 'Creating user_uploads table if not exists' });

    // Create user_uploads table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS user_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        file_path TEXT,
        quality_score INTEGER,
        mime_type VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `;

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON user_uploads(created_at);
    `;

    logger.logApiInfo('migrate-hotfix', { 
      operation: 'user_uploads table created successfully',
      success: true 
    });

    return response.status(200).json({
      success: true,
      message: 'user_uploads table created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.logApiError('migrate-hotfix', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json({
      success: false,
      error: 'Failed to create user_uploads table',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
