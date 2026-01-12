/**
 * GET /api/generate/status - Check generation status
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

    // Get generation ID from query
    const generationId = typeof request.query.id === 'string' ? request.query.id : null;
    
    if (!generationId) {
      return response.status(400).json(
        errorResponse('Generation ID is required', 400, undefined, requestOrigin)
      );
    }

    // Get generation status
    const result = await sql<{
      id: string;
      status: string;
      image_url: string | null;
      error_message: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT 
        id,
        status,
        image_url,
        error_message,
        created_at,
        updated_at
      FROM generations
      WHERE id = ${generationId} AND user_id = ${user.id}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return response.status(404).json(
        errorResponse('Generation not found', 404, undefined, requestOrigin)
      );
    }

    const generation = result.rows[0];

    return response.status(200).json(
      successResponse({
        id: generation.id,
        status: generation.status,
        imageUrl: generation.image_url,
        errorMessage: generation.error_message,
        createdAt: generation.created_at,
        updatedAt: generation.updated_at,
      }, undefined, requestOrigin)
    );
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('getGenerationStatus', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}
