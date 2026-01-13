/**
 * Bonus Service
 * Business logic for daily bonus claims - atomic operations
 */

import * as TokenRepo from '../repositories/token.repository.js';
import * as UserRepo from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Claim daily wheel bonus (random 1-10 tokens)
 * Available for all users (registered and anonymous)
 * Atomic operation: check date + add tokens + update date
 */
export async function claimDailyBonus(userId: string): Promise<{ success: boolean; tokensAwarded: number; error?: string }> {
  try {
    // Check if user exists
    const user = await UserRepo.findById(userId);
    if (!user) {
      logger.logApiError('BonusService - user not found', new Error('User not found'), {
        userId: userId?.substring(0, 8) + '...',
      });
      return { success: false, tokensAwarded: 0, error: 'User not found' };
    }

    // Get or create tokens record
    let tokens = await TokenRepo.getTokenBalance(userId);
    if (!tokens) {
      // Initialize if doesn't exist
      tokens = await TokenRepo.createTokenRecord(userId, 0);
    }

    // Award random bonus (1-10 tokens) - matching wheel values
    const bonusAmount = Math.floor(Math.random() * 10) + 1;
    
    logger.logApiInfo('BonusService - attempting to claim bonus', {
      userId: userId?.substring(0, 8) + '...',
      bonusAmount,
    });

    // Atomic operation: update balance + add transaction + update date in one query
    // This prevents race conditions where two requests could both claim the bonus
    // Uses CURRENT_DATE from PostgreSQL to ensure consistent date comparison
    const result = await TokenRepo.claimDailyBonusAtomic(userId, bonusAmount);

    if (!result.success) {
      logger.logApiInfo('BonusService - bonus already claimed today', {
        userId: userId?.substring(0, 8) + '...',
      });
      return { success: false, tokensAwarded: 0 };
    }

    logger.logApiInfo('BonusService - bonus claimed successfully', {
      userId: userId?.substring(0, 8) + '...',
      tokensAwarded: bonusAmount,
      newBalance: result.newBalance,
    });

    return { success: true, tokensAwarded: bonusAmount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.logApiError('BonusService - claimDailyBonus error', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
      message: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
}

