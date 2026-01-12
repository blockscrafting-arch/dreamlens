/**
 * POST /api/generations - Create a new generation
 * GET /api/generations - Get user's generation history
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import * as AuthService from '../services/auth.service.js';
import { successResponse, errorResponse, unauthorizedResponse, rateLimitResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { checkRateLimit, recordUsage } from '../utils/rateLimit.js';
import { logger } from '../utils/logger.js';
import { getClientIp } from '../utils/ip.js';
import { 
  validatePayloadSize,
  validateRequestBody, 
  getRequestBody,
  validateCreateGenerationRequest,
  type CreateGenerationRequestBody 
} from '../utils/validation.js';

// POST - Create generation
async function createGeneration(
  request: VercelRequest,
    response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);
    
    // Validate payload size (DoS protection)
    try {
      validatePayloadSize(request);
    } catch (error) {
      return response.status(413).json(
        errorResponse('Payload too large', 413, undefined, requestOrigin)
      );
    }
    
    // Get authenticated user (verifies auth and gets/creates user atomically)
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse(requestOrigin));
    }

    const { user } = authenticatedUser;
    
    // Extract client IP for rate limiting
    const ipAddress = getClientIp(request);

    // Validate and extract request body
    validateRequestBody(request);
    const body = getRequestBody<CreateGenerationRequestBody>(request);
    
    if (!validateCreateGenerationRequest(body)) {
      return response.status(400).json(
        errorResponse('imageUrl is required', 400, undefined, requestOrigin)
      );
    }

    const { imageUrl, promptUsed, trend, quality } = body;

    // Determine quality value for storage
    const qualityValue = quality || '1K';

    // Server-side rate limiting (additional protection)
    const rateLimit = await checkRateLimit(user.id, 'generation', 10, 60000, ipAddress, authenticatedUser.authType); // 10 per minute
    if (!rateLimit.allowed) {
      return response.status(429).json(
        rateLimitResponse(Math.ceil((rateLimit.resetTime - Date.now()) / 1000), requestOrigin)
      );
    }

    // Create generation record
    // Note: Tokens are already deducted in /api/generate/image endpoint
    const result = await sql`
      INSERT INTO generations (user_id, image_url, prompt_used, trend, quality)
      VALUES (${user.id}, ${imageUrl}, ${promptUsed || null}, ${trend || null}, ${qualityValue})
      RETURNING *
    `;

    // Log usage
    await recordUsage(user.id, 'generation', ipAddress);

    return response.status(201).json(
      successResponse({
        generation: result.rows[0],
      }, undefined, requestOrigin)
    );
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('createGeneration', error instanceof Error ? error : new Error(String(error)), {
      userId: (request.body as { userId?: string } | undefined)?.userId,
      quality: (request.body as { quality?: string } | undefined)?.quality,
    });
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}

// GET - Get generation history
async function getGenerations(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);
    
    // Get authenticated user (verifies auth and gets/creates user atomically)
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse(requestOrigin));
    }

    const { user } = authenticatedUser;

    // Get limit (default 100 for all users)
    const limit = 100;

    // Get generations
    const result = await sql`
      SELECT * FROM generations
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return response.status(200).json(
      successResponse({
        generations: result.rows,
        total: result.rows.length,
      }, undefined, requestOrigin)
    );
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('getGenerations', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method === 'POST') {
    return createGeneration(request, response);
  } else if (request.method === 'GET') {
    return getGenerations(request, response);
  } else {
    return response.status(405).json({ error: 'Method not allowed' });
  }
}

