/**
 * Token Service
 * Business logic for token operations - all operations are atomic
 */

import * as TokenRepo from '../repositories/token.repository.js';
import * as UserRepo from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Get token cost for quality
 */
export function getTokenCostForQuality(quality: string): number {
  switch (quality) {
    case '4K':
      return 3;
    case '2K':
      return 2;
    case '1K':
    default:
      return 1;
  }
}

/**
 * Get token info (balance and last bonus date)
 * Tokens should always exist due to database trigger, but we handle edge cases for old users
 */
export async function getTokenInfo(userId: string): Promise<{ balance: number; lastBonusDate: string | null }> {
  try {
    // Get user to verify existence
    const user = await UserRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get tokens - should always exist due to database trigger
    let tokens = await TokenRepo.getTokenBalance(userId);
    
    // Fallback for old users without tokens (before trigger was added)
    // Use atomic function to ensure tokens exist and welcome bonus is given if needed
    if (!tokens) {
      // Drizzle uses camelCase: clerkId instead of clerk_id
      const userType = user.clerkId ? 'clerk' : 'device';
      await TokenRepo.ensureWelcomeBonusAtomic(userId, userType);
      tokens = await TokenRepo.getTokenBalance(userId);
      if (!tokens) {
        throw new Error('Tokens not found after initialization');
      }
    }

    // Format last_bonus_date as YYYY-MM-DD string
    // DATE type in PostgreSQL doesn't have time, so we format it consistently
    let lastBonusDate: string | null = null;
    if (tokens.last_bonus_date) {
      if (tokens.last_bonus_date instanceof Date) {
        // DATE type has no time component, so we can safely use ISO string
        // But to be safe, we format it explicitly to avoid timezone issues
        const year = tokens.last_bonus_date.getFullYear();
        const month = String(tokens.last_bonus_date.getMonth() + 1).padStart(2, '0');
        const day = String(tokens.last_bonus_date.getDate()).padStart(2, '0');
        lastBonusDate = `${year}-${month}-${day}`;
      } else if (typeof tokens.last_bonus_date === 'string') {
        // Already a string, use as-is (should be YYYY-MM-DD format from PostgreSQL)
        lastBonusDate = tokens.last_bonus_date;
      } else {
        // Fallback: convert to Date and format
        const date = new Date(tokens.last_bonus_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        lastBonusDate = `${year}-${month}-${day}`;
      }
    }

    return {
      balance: tokens.balance,
      lastBonusDate,
    };
  } catch (error) {
    logger.logApiError('TokenService - getTokenInfo', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Add tokens to user (atomic operation)
 */
export async function addTokens(
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'refund',
  description: string
): Promise<number> {
  try {
    // Ensure tokens record exists
    let tokens = await TokenRepo.getTokenBalance(userId);
    if (!tokens) {
      tokens = await TokenRepo.createTokenRecord(userId, 0);
    }

    // Atomic update: balance + transaction
    const result = await TokenRepo.updateBalanceAndAddTransaction(userId, amount, type, description);
    return result.newBalance;
  } catch (error) {
    logger.logApiError('TokenService - addTokens', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
      amount,
      type,
    });
    throw error;
  }
}

/**
 * Spend tokens from user (atomic operation)
 */
export async function spendTokens(
  userId: string,
  amount: number,
  description?: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    // Get current balance
    const tokens = await TokenRepo.getTokenBalance(userId);
    if (!tokens) {
      return { success: false, newBalance: 0 };
    }

    if (tokens.balance < amount) {
      return { success: false, newBalance: tokens.balance };
    }

    // Atomic update: balance - amount + transaction
    const result = await TokenRepo.updateBalanceAndAddTransaction(
      userId,
      -amount,
      'generation',
      description || 'Token spent'
    );

    return { success: true, newBalance: result.newBalance };
  } catch (error) {
    logger.logApiError('TokenService - spendTokens', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
      amount,
    });
    throw error;
  }
}

/**
 * Initialize tokens for user
 */
export async function initializeTokens(
  userId: string,
  initialBalance: number,
  description: string
): Promise<TokenRepo.UserTokens> {
  try {
    // Check if already exists
    const existing = await TokenRepo.getTokenBalance(userId);
    if (existing) {
      return existing;
    }

    // Create new record
    const tokens = await TokenRepo.createTokenRecord(userId, initialBalance);
    
    // Add transaction if initial balance > 0
    if (initialBalance > 0) {
      await TokenRepo.addTransaction(userId, initialBalance, 'bonus', description);
    }

    return tokens;
  } catch (error) {
    logger.logApiError('TokenService - initializeTokens', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

