/**
 * POST /api/auth/register
 * Register user after Clerk authentication
 * This is called automatically when user signs up
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as UserService from '../services/user.service.js';
import { verifyAuth } from '../utils/auth.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';

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
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse());
    }

    const { email } = request.body;

    // Get or create user (creates free subscription automatically)
    const user = await UserService.getOrCreateUserByClerkId(auth.userId, email);

    return response.status(200).json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
        },
        message: 'User registered successfully',
      })
    );
  } catch (error) {
    logger.logApiError('registerUser', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}


