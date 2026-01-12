/**
 * Environment variables validation
 * Validates required environment variables at startup
 */

import { logger } from './logger.js';

interface EnvConfig {
  required: string[];
  optional: string[];
  warnings?: string[];
}

// Cache validation result to avoid repeated checks
let envValidated = false;
let envValidationError: Error | null = null;

/**
 * Validate environment variables
 * Throws error if required variables are missing
 * Caches result to avoid repeated validation
 */
export function validateEnv(): void {
  // Return cached result if already validated
  if (envValidated && !envValidationError) {
    return;
  }
  
  // If validation failed before, throw cached error
  if (envValidationError) {
    throw envValidationError;
  }
  const config: EnvConfig = {
    required: [
      'POSTGRES_URL', // or DATABASE_URL
      'GEMINI_API_KEY',
      // Note: CLERK_SECRET_KEY is conditionally required
      // If Clerk authentication is used, it must be set
      // Otherwise, device ID authentication will be used
    ],
    optional: [
      'CLERK_SECRET_KEY', // Required if using Clerk auth, optional for device-only auth
      'TELEGRAM_BOT_TOKEN', // Required for Telegram Mini App authentication
      'POSTGRES_URL_NON_POOLING',
      'DATABASE_URL',
      'GEMINI_API_KEY_BACKUP',
      'ALLOWED_ORIGINS',
      'DB_INIT_SECRET',
      'YOOKASSA_SHOP_ID',
      'YOOKASSA_SECRET_KEY',
      'VITE_CLERK_PUBLISHABLE_KEY',
      'VITE_GA_MEASUREMENT_ID',
      'VITE_SENTRY_DSN',
      'BLOB_READ_WRITE_TOKEN',
    ],
    warnings: [],
  };

  // Check required variables
  const missing: string[] = [];
  for (const key of config.required) {
    // Special handling for POSTGRES_URL - also check DATABASE_URL
    if (key === 'POSTGRES_URL') {
      if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
        missing.push(key);
      }
    } else if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    // Provide helpful error messages for missing variables
    let helpMessage = `Missing required environment variables: ${missing.join(', ')}\n\n`;
    
    if (missing.includes('POSTGRES_URL')) {
      helpMessage += 
        'To fix POSTGRES_URL:\n' +
        '1. If using Neon: Create a database at https://neon.tech and copy the Connection String\n' +
        '2. If using Vercel Postgres: Create Postgres Storage in Vercel Dashboard → Storage\n' +
        '3. Add POSTGRES_URL to Vercel Dashboard → Settings → Environment Variables\n' +
        '4. Redeploy your project after adding the variable\n\n';
    }
    
    if (missing.includes('GEMINI_API_KEY')) {
      helpMessage += 
        'To fix GEMINI_API_KEY:\n' +
        '1. Get your API key from https://aistudio.google.com/app/apikey\n' +
        '2. Add GEMINI_API_KEY to Vercel Dashboard → Settings → Environment Variables\n' +
        '3. Redeploy your project\n\n';
    }
    
    helpMessage += 'Please set these variables in your environment or .env file.';
    
    const error = new Error(helpMessage);
    logger.error('Environment validation failed', error, { 
      missing,
      nodeEnv: process.env.NODE_ENV,
    });
    envValidationError = error;
    throw error;
  }

  // Check for warnings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ALLOWED_ORIGINS) {
      config.warnings?.push(
        'ALLOWED_ORIGINS is not set. CORS requests will be denied in production.'
      );
    }
    if (!process.env.CLERK_SECRET_KEY) {
      config.warnings?.push(
        'CLERK_SECRET_KEY is not set. Clerk authentication will not work. Users with Clerk tokens will receive 401 Unauthorized errors.'
      );
    }
  }

  // Log warnings
  if (config.warnings && config.warnings.length > 0) {
    for (const warning of config.warnings) {
      logger.warn('Environment configuration warning', { warning });
    }
  }

  logger.info('Environment variables validated successfully', {
    requiredCount: config.required.length,
    optionalCount: config.optional.length,
    nodeEnv: process.env.NODE_ENV,
  });
  
  // Mark as validated
  envValidated = true;
}

/**
 * Validate environment variables lazily (only when needed)
 * This is called automatically by functions that need env variables
 */
export function validateEnvLazy(): void {
  if (!envValidated) {
    try {
      validateEnv();
    } catch (error) {
      // Error is already cached in validateEnv
      throw error;
    }
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && !fallback) {
    throw new Error(`Environment variable ${key} is not set and no fallback provided`);
  }
  return value || fallback || '';
}

/**
 * Check if environment variable is set
 */
export function hasEnv(key: string): boolean {
  return !!process.env[key];
}

