/**
 * GET /api/tokens - Get user token balance
 * POST /api/tokens - Claim daily bonus tokens
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, type RequestContext } from '../utils/middleware.js';
import * as AuthService from '../services/auth.service.js';
import * as TokenService from '../services/token.service.js';
import * as BonusService from '../services/bonus.service.js';
import * as SubscriptionService from '../services/subscription.service.js';
import * as GenerationService from '../services/generation.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { incrementCounter, recordHistogram } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';
import { getCorsHeaders } from '../utils/cors.js';

// GET - Get token balance
const getTokenBalance = withAuth(
  async (request: VercelRequest, response: VercelResponse, context: RequestContext) => {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    
    // Get authenticated user (already verified by middleware)
    const authenticatedUser = await AuthService.getOrCreateUserFromAuth(context.auth);
    const { user } = authenticatedUser;

    // Get token balance and last bonus date
    const tokensInfo = await TokenService.getTokenInfo(user.id);
    
    // Get server date for client-side bonus availability check
    // This ensures timezone consistency between client and server
    const serverDate = new Date().toISOString().split('T')[0];
    const canClaimBonus = tokensInfo.lastBonusDate !== serverDate;
    
    // Get subscription and free generation info
    const subscription = await SubscriptionService.getUserSubscription(user.id);
    const plan = subscription?.plan || 'free';
    const limits = SubscriptionService.getSubscriptionLimits(plan);
    const usedToday = await GenerationService.countGenerationsToday(user.id);
    const freeGenerationsRemaining = Math.max(0, limits.dailyGenerations - usedToday);
    
    // Record metrics
    incrementCounter('tokens.balance_checked', 1, { authType: context.authType });
    recordHistogram('tokens.balance', tokensInfo.balance, { authType: context.authType });

    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');

    return response.status(200).json(
      successResponse({
        balance: tokensInfo.balance,
        lastBonusDate: tokensInfo.lastBonusDate,
        serverDate,
        canClaimBonus,
        // Free generation info
        freeGenerations: {
          remaining: freeGenerationsRemaining,
          total: limits.dailyGenerations,
          maxQuality: limits.quality,
        },
        plan,
      }, undefined, requestOrigin)
    );
  },
  {
    methods: ['GET'],
  }
);

// POST - Claim daily bonus
const claimBonus = withAuth(
  async (request: VercelRequest, response: VercelResponse, context: RequestContext) => {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    
    // Get authenticated user (already verified by middleware)
    const authenticatedUser = await AuthService.getOrCreateUserFromAuth(context.auth);
    const { user } = authenticatedUser;

    // Claim daily bonus
    const result = await BonusService.claimDailyBonus(user.id);

    if (!result.success) {
      // Log the failure for debugging
      logger.logApiInfo('Bonus claim failed', {
        requestId: context.requestId,
        userId: user.id.substring(0, 8) + '...',
        authType: context.authType,
        error: result.error || 'Unknown error',
      });

      // Check if it's an error about user not found
      if (result.error && result.error.includes('not found')) {
        incrementCounter('bonus.claim_failed', 1, { reason: 'user_not_found', authType: context.authType });
        return response.status(404).json(
          errorResponse('Пользователь не найден', 404, undefined, requestOrigin)
        );
      }

      // Check if it's an error about registration
      if (result.error && result.error.includes('registered')) {
        incrementCounter('bonus.claim_failed', 1, { reason: 'not_registered', authType: context.authType });
        return response.status(403).json(
          errorResponse(result.error, 403, undefined, requestOrigin)
        );
      }

      // Otherwise, it's already claimed today (most common case)
      incrementCounter('bonus.claim_failed', 1, { reason: 'already_claimed', authType: context.authType });
      return response.status(400).json(
        errorResponse('Ежедневный бонус уже получен сегодня', 400, undefined, requestOrigin)
      );
    }

    // Record metrics
    incrementCounter('bonus.claimed', 1, { authType: context.authType });
    recordHistogram('bonus.tokens_awarded', result.tokensAwarded, { authType: context.authType });

    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');

    return response.status(200).json(
      successResponse({
        tokensAwarded: result.tokensAwarded,
        message: `Получено ${result.tokensAwarded} токенов!`,
      }, undefined, requestOrigin)
    );
  },
  {
    methods: ['POST'],
  }
);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    const corsHeaders = getCorsHeaders(requestOrigin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });
    return response.status(204).end();
  }
  
  if (request.method === 'GET') {
    return getTokenBalance(request, response);
  } else if (request.method === 'POST') {
    return claimBonus(request, response);
  } else {
    return response.status(405).json({ error: 'Method not allowed' });
  }
}

