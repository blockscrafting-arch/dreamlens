/**
 * Subscription Service
 * Business logic for subscriptions
 */

import * as SubscriptionRepo from '../repositories/subscription.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Get subscription limits (kept for backward compatibility)
 */
export function getSubscriptionLimits(plan: string): { dailyGenerations: number; maxHistory: number; quality: string } {
  switch (plan) {
    case 'premium':
      return { dailyGenerations: Infinity, maxHistory: Infinity, quality: '4K' };
    case 'pro':
      return { dailyGenerations: 50, maxHistory: 100, quality: '2K' };
    case 'free':
    default:
      return { dailyGenerations: 0, maxHistory: 10, quality: '1K' };
  }
}

/**
 * Get user subscription
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionRepo.Subscription | null> {
  try {
    return await SubscriptionRepo.getUserSubscription(userId);
  } catch (error) {
    logger.logApiError('SubscriptionService - getUserSubscription', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

