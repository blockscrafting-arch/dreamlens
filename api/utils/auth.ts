/**
 * Authentication utilities
 * Supports both Clerk (optional) and device ID (anonymous)
 * For Vercel Serverless Functions
 */

import type { VercelRequest } from '@vercel/node';
import { createHmac } from 'crypto';
import { logger } from './logger.js';

import { AUTH_HEADER_PREFIXES } from '../../shared/constants.js';

export interface AuthResult {
  userId: string | null;
  isAuthenticated: boolean;
  authType: 'device' | 'telegram' | null;
  error?: string;
  telegramData?: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
  };
}

// Authentication header prefixes
const { DEVICE: AUTH_HEADER_DEVICE_PREFIX, TELEGRAM: AUTH_HEADER_TELEGRAM_PREFIX, BEARER: AUTH_HEADER_BEARER_PREFIX } = AUTH_HEADER_PREFIXES;

// Import shared validation rules
import { getDeviceIdValidationError } from './validation-rules.js';

/**
 * Verify authentication from request
 * Supports both device ID and Telegram initData
 */
export async function verifyAuth(request: VercelRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      // Log detailed info for debugging 401 errors
      logger.logApiInfo('Auth verification failed - missing authorization header', {
        hasAuthHeader: false,
        allHeaders: Object.keys(request.headers),
        userAgent: request.headers['user-agent']?.substring(0, 50),
        origin: request.headers.origin,
        referer: request.headers.referer,
        url: request.url,
        method: request.method,
      });
      return {
        userId: null,
        isAuthenticated: false,
        authType: null,
        error: 'Missing authorization header',
      };
    }

    // Check if it's a device ID (starts with 'Device ')
    if (authHeader.startsWith(AUTH_HEADER_DEVICE_PREFIX)) {
      const deviceId = authHeader.replace(AUTH_HEADER_DEVICE_PREFIX, '').trim();
      if (!deviceId) {
        return {
          userId: null,
          isAuthenticated: false,
          authType: null,
          error: 'Missing device ID',
        };
      }

      // Validate device ID format using shared validation rules
      const validationError = getDeviceIdValidationError(deviceId);
      if (validationError) {
        return {
          userId: null,
          isAuthenticated: false,
          authType: null,
          error: validationError,
        };
      }

      return {
        userId: deviceId,
        isAuthenticated: true,
        authType: 'device',
      };
    }

    // Check if it's a Telegram InitData
    if (authHeader.startsWith(AUTH_HEADER_TELEGRAM_PREFIX)) {
      const initData = authHeader.replace(AUTH_HEADER_TELEGRAM_PREFIX, '').trim();
      
      if (!initData) {
        return {
          userId: null,
          isAuthenticated: false,
          authType: null,
          error: 'Missing Telegram initData',
        };
      }

      const validationResult = validateTelegramInitData(initData);
      
      if (!validationResult.isValid) {
        return {
          userId: null,
          isAuthenticated: false,
          authType: null,
          error: validationResult.error || 'Invalid Telegram initData',
        };
      }

      return {
        userId: validationResult.userId || null,
        isAuthenticated: true,
        authType: 'telegram',
        telegramData: validationResult.telegramData,
      };
    }

    // Clerk Bearer token (legacy, deprecated)
    if (authHeader.startsWith(AUTH_HEADER_BEARER_PREFIX)) {
      logger.warn('Clerk auth attempt failed - Clerk support removed');
      return {
        userId: null,
        isAuthenticated: false,
        authType: null,
        error: 'Clerk authentication is deprecated',
      };
    }

    return {
      userId: null,
      isAuthenticated: false,
      authType: null,
      error: 'Invalid authorization format',
    };
  } catch (error) {
    logger.logApiError('Auth verification - unexpected error', error instanceof Error ? error : new Error(String(error)));
    return {
      userId: null,
      isAuthenticated: false,
      authType: null,
      error: 'Authentication failed',
    };
  }
}

/**
 * Validate Telegram WebApp InitData
 * Verifies the hash signature and extracts user data
 * 
 * @param initData - Query string from Telegram.WebApp.initData
 * @returns Validation result with user data if valid
 */
export function validateTelegramInitData(initData: string): {
  isValid: boolean;
  userId?: string;
  telegramData?: AuthResult['telegramData'];
  error?: string;
} {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!TELEGRAM_BOT_TOKEN) {
      logger.warn('Telegram auth failed - TELEGRAM_BOT_TOKEN not configured', {
        hasInitData: !!initData,
        initDataLength: initData.length,
      });
      return {
        isValid: false,
        error: 'Telegram bot token not configured',
      };
    }

    // Parse initData query string
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return {
        isValid: false,
        error: 'Missing hash in initData',
      };
    }

    // Remove hash from params for verification
    params.delete('hash');
    
    // Sort parameters alphabetically and create data-check-string
    const dataCheckArray: string[] = [];
    params.forEach((value, key) => {
      dataCheckArray.push(`${key}=${value}`);
    });
    dataCheckArray.sort();
    const dataCheckString = dataCheckArray.join('\n');

    // Create secret key from bot token
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate hash
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      logger.logApiError('Telegram hash verification failed', new Error('Hash mismatch'), {
        hashLength: hash.length,
        calculatedHashLength: calculatedHash.length,
      });
      return {
        isValid: false,
        error: 'Invalid hash',
      };
    }

    // Check auth_date (should be within 24 hours)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = currentTimestamp - authTimestamp;
      
      // Allow 24 hours + 5 minutes buffer
      if (timeDiff > 86400 + 300 || timeDiff < -300) {
        logger.logApiError('Telegram auth_date expired', new Error('Auth date too old or in future'), {
          authTimestamp,
          currentTimestamp,
          timeDiff,
        });
        return {
          isValid: false,
          error: 'Auth date expired',
        };
      }
    }

    // Extract user data
    const userJson = params.get('user');
    if (!userJson) {
      return {
        isValid: false,
        error: 'Missing user data',
      };
    }

    let userData: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };

    try {
      userData = JSON.parse(userJson);
    } catch (error) {
      logger.logApiError('Telegram user data parse failed', error instanceof Error ? error : new Error(String(error)), {
        userJsonLength: userJson.length,
      });
      return {
        isValid: false,
        error: 'Invalid user data format',
      };
    }

    if (!userData.id) {
      return {
        isValid: false,
        error: 'Missing user ID',
      };
    }

    return {
      isValid: true,
      userId: String(userData.id),
      telegramData: {
        id: String(userData.id),
        first_name: userData.first_name || undefined,
        last_name: userData.last_name || undefined,
        username: userData.username || undefined,
        photo_url: userData.photo_url || undefined,
        language_code: userData.language_code || undefined,
      },
    };
  } catch (error) {
    logger.logApiError('Telegram initData validation error', error instanceof Error ? error : new Error(String(error)), {
      initDataLength: initData.length,
    });
    return {
      isValid: false,
      error: 'Validation error',
    };
  }
}


