/**
 * User Service
 * Business logic for user management and welcome bonuses
 */

import * as UserRepo from '../repositories/user.repository.js';
import * as TokenRepo from '../repositories/token.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Get or create user by Clerk ID
 * Optimized: reads first (fast), writes only when necessary
 * Tokens and welcome bonus are automatically created by database trigger
 */
export async function getOrCreateUserByClerkId(clerkId: string, email?: string): Promise<UserRepo.User> {
  try {
    // Use atomic getOrCreate - prevents race conditions
    const user = await UserRepo.getOrCreateUser({
      clerk_id: clerkId,
      email: email,
    });

    // Tokens and welcome bonus are automatically created by database trigger
    // For backward compatibility, ensure welcome bonus is given if missing
    // Check is done inside ensureWelcomeBonus by checking transaction existence
    await ensureWelcomeBonus(user.id, 'clerk');

    logger.logApiInfo('UserService - getOrCreateUserByClerkId', {
      userId: user.id?.substring(0, 8) + '...',
      clerkId: clerkId?.substring(0, 8) + '...',
    });

    return user;
  } catch (error) {
    logger.logApiError('UserService - getOrCreateUserByClerkId', error instanceof Error ? error : new Error(String(error)), {
      clerkId: clerkId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Get or create user by Telegram ID
 * Optimized: reads first (fast), writes only when necessary
 * Tokens and welcome bonus are automatically created by database trigger
 */
export async function getOrCreateUserByTelegramId(
  telegramId: string,
  userData?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
  }
): Promise<UserRepo.User> {
  try {
    // Use atomic getOrCreate - prevents race conditions
    const user = await UserRepo.getOrCreateUser({
      telegram_id: telegramId,
      first_name: userData?.first_name,
      last_name: userData?.last_name,
      username: userData?.username,
      photo_url: userData?.photo_url,
      language_code: userData?.language_code,
    });

    // Tokens and welcome bonus are automatically created by database trigger
    // For backward compatibility, ensure welcome bonus is given if missing
    // Check is done inside ensureWelcomeBonus by checking transaction existence
    await ensureWelcomeBonus(user.id, 'telegram');

    logger.logApiInfo('UserService - getOrCreateUserByTelegramId', {
      userId: user.id?.substring(0, 8) + '...',
      telegramId: telegramId?.substring(0, 8) + '...',
    });

    return user;
  } catch (error) {
    logger.logApiError('UserService - getOrCreateUserByTelegramId', error instanceof Error ? error : new Error(String(error)), {
      telegramId: telegramId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Get or create user by device ID (anonymous)
 * Optimized: reads first (fast), writes only when necessary
 * Tokens and welcome bonus are automatically created by database trigger
 */
export async function getOrCreateUserByDeviceId(deviceId: string): Promise<UserRepo.User> {
  try {
    // Use atomic getOrCreate - prevents race conditions
    const user = await UserRepo.getOrCreateUser({
      device_id: deviceId,
    });

    // Tokens and welcome bonus are automatically created by database trigger
    // For backward compatibility, ensure welcome bonus is given if missing
    // Check is done inside ensureWelcomeBonus by checking transaction existence
    await ensureWelcomeBonus(user.id, 'device');

    logger.logApiInfo('UserService - getOrCreateUserByDeviceId', {
      userId: user.id?.substring(0, 8) + '...',
      deviceId: deviceId?.substring(0, 8) + '...',
    });

    return user;
  } catch (error) {
    logger.logApiError('UserService - getOrCreateUserByDeviceId', error instanceof Error ? error : new Error(String(error)), {
      deviceId: deviceId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Ensure welcome bonus/pack is given to user if they haven't received it
 * Uses atomic operation to check and award bonus in one query
 * This is for backward compatibility with existing users (before database trigger was added)
 * New users automatically get welcome bonus via database trigger
 */
async function ensureWelcomeBonus(userId: string, userType: 'clerk' | 'device' | 'telegram'): Promise<void> {
  try {
    // Use atomic operation to check and award bonus
    // This prevents race conditions and ensures idempotency
    await TokenRepo.ensureWelcomeBonusAtomic(userId, userType);
  } catch (error) {
    logger.logApiError('UserService - ensureWelcomeBonus', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
      userType,
    });
    throw error;
  }
}

