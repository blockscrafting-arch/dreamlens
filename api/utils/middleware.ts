/**
 * Middleware system for API routes
 * Provides unified request handling: auth, validation, error handling, logging
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, type AuthResult } from './auth.js';
import { logger } from './logger.js';
import { getCorsHeaders } from './cors.js';
import { errorResponse, unauthorizedResponse } from './response.js';
import { validatePayloadSize } from './validation.js';
import { checkRateLimit } from './rateLimit.js';
import { z } from 'zod';

export interface RequestContext {
  userId: string;
  authType: 'clerk' | 'device' | 'telegram';
  auth: AuthResult;
  requestId: string;
  startTime: number;
  ipAddress?: string | null;
}

export type MiddlewareHandler<T = unknown> = (
  request: VercelRequest,
  response: VercelResponse,
  context: RequestContext
) => Promise<T>;

export interface MiddlewareOptions {
  requireAuth?: boolean;
  methods?: string[];
  rateLimit?: {
    action: string;
    limit: number;
    windowMs: number;
  };
  validatePayload?: boolean;
  validateSchema?: z.ZodSchema;
  skipAuth?: boolean;
}

import { getClientIp } from './ip.js';

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Main middleware wrapper
 * Handles common concerns: auth, validation, rate limiting, error handling
 */
export function withMiddleware<T = unknown>(
  handler: MiddlewareHandler<T>,
  options: MiddlewareOptions = {}
): (request: VercelRequest, response: VercelResponse) => Promise<void> {
  return async (request: VercelRequest, response: VercelResponse) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;

    // Set CORS headers
    const corsHeaders = getCorsHeaders(requestOrigin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    try {
      // Method validation
      if (options.methods && !options.methods.includes(request.method || '')) {
        logger.logApiInfo('Method not allowed', {
          requestId,
          method: request.method,
          allowedMethods: options.methods,
        });
        response.status(405).json(
          errorResponse('Method not allowed', 405, undefined, requestOrigin)
        );
        return;
      }

      // Payload size validation
      if (options.validatePayload !== false) {
        try {
          validatePayloadSize(request);
        } catch (error) {
          logger.logApiError('Payload validation failed', error instanceof Error ? error : new Error(String(error)), {
            requestId,
            contentLength: request.headers['content-length'],
          });
          response.status(413).json(
            errorResponse('Payload too large', 413, undefined, requestOrigin)
          );
          return;
        }
      }

      // Extract client IP address
      const ipAddress = getClientIp(request);

      // Authentication
      let auth: AuthResult | null = null;
      let context: RequestContext | null = null;

      if (options.requireAuth !== false && !options.skipAuth) {
        auth = await verifyAuth(request);
        
        if (!auth.isAuthenticated || !auth.userId || !auth.authType) {
          logger.logApiInfo('Unauthorized request', {
            requestId,
            authError: auth.error,
          });
          response.status(401).json(unauthorizedResponse(requestOrigin));
          return;
        }

        context = {
          userId: auth.userId,
          authType: auth.authType,
          auth,
          requestId,
          startTime,
          ipAddress,
        };
      } else {
        context = {
          userId: '',
          authType: 'device',
          auth: { userId: null, isAuthenticated: false, authType: null },
          requestId,
          startTime,
          ipAddress,
        };
      }

      // Rate limiting
      if (options.rateLimit && context.userId) {
        const rateLimitResult = await checkRateLimit(
          context.userId,
          options.rateLimit.action,
          options.rateLimit.limit,
          options.rateLimit.windowMs,
          context.ipAddress,
          context.authType
        );

        if (!rateLimitResult.allowed) {
          logger.logApiInfo('Rate limit exceeded', {
            requestId,
            userId: context.userId.substring(0, 8) + '...',
            action: options.rateLimit.action,
            ipAddress: context.ipAddress?.substring(0, 15) + '...',
          });
          response.status(429).json(
            errorResponse(
              rateLimitResult.error || 'Rate limit exceeded',
              429,
              undefined,
              requestOrigin
            )
          );
          return;
        }
      }

      // Schema validation
      if (options.validateSchema && request.body) {
        try {
          const validated = options.validateSchema.parse(request.body);
          // Replace request body with validated data
          request.body = validated;
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.logApiError('Schema validation failed', error, {
              requestId,
              errors: error.issues,
            });
            response.status(400).json(
              errorResponse(
                'Validation failed',
                400,
                error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
                requestOrigin
              )
            );
            return;
          }
          throw error;
        }
      }

      // Execute handler
      await handler(request, response, context!);

      // Log successful request
      const duration = Date.now() - startTime;
      logger.logApiInfo('Request completed', {
        requestId,
        method: request.method,
        duration,
        userId: context?.userId?.substring(0, 8) + '...',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiError('Request failed', error instanceof Error ? error : new Error(String(error)), {
        requestId,
        method: request.method,
        duration,
        url: request.url,
      });

      // Don't send response if already sent
      if (!response.headersSent) {
        response.status(500).json(
          errorResponse(
            'Internal server error',
            500,
            process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
            requestOrigin
          )
        );
      }
    }
  };
}

/**
 * Helper to create authenticated middleware
 */
export function withAuth<T = unknown>(
  handler: MiddlewareHandler<T>,
  options: Omit<MiddlewareOptions, 'requireAuth'> = {}
): (request: VercelRequest, response: VercelResponse) => Promise<void> {
  return withMiddleware(handler, { ...options, requireAuth: true });
}

/**
 * Helper to create public middleware (no auth required)
 */
export function withPublic<T = unknown>(
  handler: MiddlewareHandler<T>,
  options: Omit<MiddlewareOptions, 'requireAuth' | 'skipAuth'> = {}
): (request: VercelRequest, response: VercelResponse) => Promise<void> {
  return withMiddleware(handler, { ...options, requireAuth: false, skipAuth: true });
}
