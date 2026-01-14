/**
 * GET /api/user/uploads - Get user's uploaded images
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import * as AuthService from '../services/auth.service.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);

    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    // Get authenticated user
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse(requestOrigin));
    }

    const { user } = authenticatedUser;

    // Get uploads from database
    const result = await sql<{
      id: string;
      url: string;
      quality_score: number | null;
      mime_type: string | null;
      created_at: Date;
    }>`
      SELECT 
        id,
        url,
        quality_score,
        mime_type,
        created_at
      FROM user_uploads
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return response.status(200).json(
      successResponse({
        uploads: result.rows,
        total: result.rows.length,
      }, undefined, requestOrigin)
    );
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('getUserUploads', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}
