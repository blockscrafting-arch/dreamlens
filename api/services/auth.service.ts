/**
 * Unified Authentication Service
 * Single point of entry for all user authentication and creation
 * This service combines auth verification with user creation/retrieval
 */

import type { VercelRequest } from '@vercel/node';
import { verifyAuth, type AuthResult } from '../utils/auth.js';
import * as UserRepo from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  user: UserRepo.User;
  authType: 'device' | 'telegram';
}

/**
 * Get or create user from authentication result
 * This is the single point of entry for all user operations
 * Tokens and welcome bonus are automatically created by database trigger
 */
export async function getOrCreateUserFromAuth(
  authResult: AuthResult
): Promise<AuthenticatedUser> {
  if (!authResult.isAuthenticated || !authResult.userId) {
    throw new Error('User not authenticated');
  }

  if (!authResult.authType) {
    throw new Error('Invalid auth type');
  }

  try {
    let user: UserRepo.User;

    if (authResult.authType === 'telegram') {
      if (!authResult.telegramData) {
        throw new Error('Missing Telegram user data');
      }
      user = await UserRepo.getOrCreateUser({
        telegram_id: authResult.userId,
        first_name: authResult.telegramData.first_name,
        last_name: authResult.telegramData.last_name,
        username: authResult.telegramData.username,
        photo_url: authResult.telegramData.photo_url,
        language_code: authResult.telegramData.language_code,
      });
    } else if (authResult.authType === 'device') {
      user = await UserRepo.getOrCreateUser({
        device_id: authResult.userId,
      });
    } else {
      throw new Error('Invalid auth type');
    }

    // Tokens and welcome bonus are automatically created by database triggers
    // No need to check or create them here

    return {
      user,
      authType: authResult.authType,
    };
  } catch (error) {
    logger.logApiError('AuthService - getOrCreateUserFromAuth', 
      error instanceof Error ? error : new Error(String(error)), {
      authType: authResult.authType,
      userId: authResult.userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Middleware helper: Get authenticated user from request
 * This is the main entry point for most endpoints
 */
export async function getAuthenticatedUser(
  request: VercelRequest
): Promise<AuthenticatedUser> {
  const authResult = await verifyAuth(request);
  
  if (!authResult.isAuthenticated || !authResult.userId || !authResult.authType) {
    throw new Error('User not authenticated');
  }

  return getOrCreateUserFromAuth(authResult);
}
