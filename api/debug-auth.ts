/**
 * GET /api/debug-auth - Diagnostic endpoint for authentication debugging
 * 
 * This endpoint helps diagnose authentication issues by checking:
 * - CLERK_SECRET_KEY presence and format
 * - Authorization header received
 * - Detailed error from verifyAuth
 * 
 * WARNING: This endpoint should be removed or protected in production
 * It exposes configuration details that could be sensitive
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './utils/auth.js';
import { getCorsHeaders } from './utils/cors.js';

interface DebugInfo {
  timestamp: string;
  environment: {
    nodeEnv: string;
    hasClerkSecretKey: boolean;
    clerkKeyPrefix: string | null;
    clerkKeyLength: number | null;
    clerkKeyType: 'test' | 'live' | 'unknown' | 'missing';
  };
  request: {
    method: string;
    url: string;
    hasAuthHeader: boolean;
    authHeaderPrefix: string | null;
    authHeaderLength: number | null;
    authHeaderType: 'device' | 'bearer' | 'unknown' | 'missing';
  };
  authResult: {
    isAuthenticated: boolean;
    authType: 'clerk' | 'device' | 'telegram' | null;
    userId: string | null;
    error: string | null;
    errorDetails?: Record<string, unknown>;
  };
  recommendations: string[];
}

function maskKey(key: string | undefined, length: number = 20): string | null {
  if (!key) return null;
  if (key.length <= length) return '***';
  return key.substring(0, length) + '...';
}

function getKeyType(key: string | undefined): 'test' | 'live' | 'unknown' | 'missing' {
  if (!key) return 'missing';
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  return 'unknown';
}

function getAuthHeaderType(authHeader: string | undefined): 'device' | 'bearer' | 'unknown' | 'missing' {
  if (!authHeader) return 'missing';
  if (authHeader.startsWith('Device ')) return 'device';
  if (authHeader.startsWith('Bearer ')) return 'bearer';
  return 'unknown';
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  const corsHeaders = getCorsHeaders(requestOrigin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.setHeader(key, value);
  });

  const debugInfo: DebugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
      clerkKeyPrefix: maskKey(process.env.CLERK_SECRET_KEY, 20),
      clerkKeyLength: process.env.CLERK_SECRET_KEY?.length || null,
      clerkKeyType: getKeyType(process.env.CLERK_SECRET_KEY),
    },
    request: {
      method: request.method || 'unknown',
      url: request.url || 'unknown',
      hasAuthHeader: !!request.headers.authorization,
      authHeaderPrefix: maskKey(request.headers.authorization, 30),
      authHeaderLength: request.headers.authorization?.length || null,
      authHeaderType: getAuthHeaderType(request.headers.authorization),
    },
    authResult: {
      isAuthenticated: false,
      authType: null,
      userId: null,
      error: null,
    },
    recommendations: [],
  };

  // Try to verify auth and capture detailed error
  try {
    const authResult = await verifyAuth(request);
    
    debugInfo.authResult = {
      isAuthenticated: authResult.isAuthenticated,
      authType: authResult.authType,
      userId: authResult.userId ? authResult.userId.substring(0, 8) + '...' : null,
      error: authResult.error || null,
    };

    // Add error details if available
    if (authResult.error) {
      debugInfo.authResult.errorDetails = {
        errorMessage: authResult.error,
      };
    }
  } catch (error) {
    debugInfo.authResult.error = error instanceof Error ? error.message : String(error);
    debugInfo.authResult.errorDetails = {
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };
  }

  // Generate recommendations based on findings
  if (!debugInfo.environment.hasClerkSecretKey) {
    debugInfo.recommendations.push(
      'CLERK_SECRET_KEY is missing. Add it to Vercel Dashboard → Settings → Environment Variables'
    );
  }

  if (debugInfo.environment.clerkKeyType === 'unknown') {
    debugInfo.recommendations.push(
      'CLERK_SECRET_KEY has unexpected format. Should start with sk_test_ or sk_live_'
    );
  }

  if (debugInfo.environment.clerkKeyType === 'test' && debugInfo.environment.nodeEnv === 'production') {
    debugInfo.recommendations.push(
      'WARNING: Using TEST key (sk_test_) in PRODUCTION. This will cause authentication failures if frontend uses pk_live_ key'
    );
  }

  if (!debugInfo.request.hasAuthHeader) {
    debugInfo.recommendations.push(
      'Authorization header is missing. Frontend should send "Authorization: Bearer <token>" or "Authorization: Device <deviceId>"'
    );
  }

  if (debugInfo.request.authHeaderType === 'bearer' && !debugInfo.environment.hasClerkSecretKey) {
    debugInfo.recommendations.push(
      'Bearer token detected but CLERK_SECRET_KEY is missing. Cannot verify Clerk tokens without secret key'
    );
  }

  if (debugInfo.request.authHeaderType === 'bearer' && debugInfo.authResult.error) {
    if (debugInfo.authResult.error.includes('expired')) {
      debugInfo.recommendations.push('Token is expired. User needs to sign in again');
    } else if (debugInfo.authResult.error.includes('invalid')) {
      debugInfo.recommendations.push(
        'Token is invalid. Check if VITE_CLERK_PUBLISHABLE_KEY matches CLERK_SECRET_KEY (test/test or live/live)'
      );
    } else if (debugInfo.authResult.error.includes('signature')) {
      debugInfo.recommendations.push(
        'Token signature verification failed. Likely key mismatch between frontend (pk_*) and backend (sk_*)'
      );
    }
  }

  if (debugInfo.request.authHeaderType === 'device' && !debugInfo.authResult.isAuthenticated) {
    debugInfo.recommendations.push(
      'Device ID authentication failed. Check device ID format and validation rules'
    );
  }

  if (debugInfo.request.authHeaderType === 'unknown') {
    debugInfo.recommendations.push(
      'Authorization header format is invalid. Should start with "Bearer " or "Device "'
    );
  }

  // Return debug info
  return response.status(200).json({
    success: true,
    debug: debugInfo,
    note: 'This is a diagnostic endpoint. Remove or protect it in production.',
  });
}
