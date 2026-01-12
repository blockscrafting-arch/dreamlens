/**
 * GET /api/user - Get user profile and subscription details
 * GET /api/stats - Get usage statistics (for analytics)
 * 
 * This unified route handles both /api/user and /api/stats endpoints
 * to reduce the number of Serverless Functions on Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import * as UserService from '../services/user.service.js';
import * as SubscriptionService from '../services/subscription.service.js';
import * as GenerationService from '../services/generation.service.js';
import { verifyAuth } from '../utils/auth.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';

// Handle /api/user endpoint
async function handleUser(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse());
    }

    // Get or create user
    const user = auth.authType === 'device'
      ? await UserService.getOrCreateUserByDeviceId(auth.userId)
      : await UserService.getOrCreateUserByClerkId(auth.userId);
    
    // Get subscription
    const subscription = await SubscriptionService.getUserSubscription(user.id);
    const plan = subscription?.plan || 'free';
    
    // Get limits
    const limits = SubscriptionService.getSubscriptionLimits(plan);
    
    // Get usage today
    const usedToday = await GenerationService.countGenerationsToday(user.id);
    const remaining = limits.dailyGenerations === Infinity 
      ? Infinity 
      : Math.max(0, limits.dailyGenerations - usedToday);

    return response.status(200).json(
      successResponse({
        // User profile data
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        // Subscription data
        subscription: subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              periodEnd: subscription.current_period_end,
            }
          : null,
        // Subscription limits and usage
        plan,
        status: subscription?.status || 'active',
        limits,
        usage: {
          usedToday,
          remaining,
          maxHistory: limits.maxHistory,
        },
        periodEnd: subscription?.current_period_end || null,
      })
    );
  } catch (error) {
    logger.logApiError('getUser', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}

// Handle /api/stats endpoint
async function handleStats(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse());
    }

    // Get user stats
    const userStats = await sql`
      SELECT 
        COUNT(DISTINCT g.id) as total_generations,
        COUNT(DISTINCT CASE WHEN g.created_at >= CURRENT_DATE THEN g.id END) as today_generations,
        COUNT(DISTINCT CASE WHEN g.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN g.id END) as week_generations
      FROM generations g
      WHERE g.user_id = (SELECT id FROM users WHERE clerk_id = ${auth.userId})
    `;

    // Get subscription stats
    const subscriptionStats = await sql`
      SELECT 
        plan,
        COUNT(*) as count
      FROM subscriptions
      WHERE status = 'active'
      GROUP BY plan
    `;

    return response.status(200).json(
      successResponse({
        user: userStats.rows[0],
        subscriptions: subscriptionStats.rows,
      })
    );
  } catch (error) {
    logger.logApiError('getStats', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Determine which endpoint to handle based on the URL path
  const url = request.url || '';
  const path = url.split('?')[0]; // Remove query string

  if (path.includes('/stats')) {
    return handleStats(request, response);
  } else {
    // Default to /api/user
    return handleUser(request, response);
  }
}

