/**
 * POST /api/payments/create - Create a payment with ЮKassa
 * POST /api/payments/webhook - Webhook handler for ЮKassa payment notifications
 * 
 * This dynamic route handles both /api/payments/create and /api/payments/webhook
 * to reduce the number of Serverless Functions on Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import crypto from 'crypto';
import * as AuthService from '../services/auth.service.js';
import * as TokenService from '../services/token.service.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';
import { 
  validatePayloadSize,
  validateRequestBody, 
  getRequestBody,
  validateCreatePaymentRequest,
  type CreatePaymentRequestBody 
} from '../utils/validation.js';

// Token packages pricing
const TOKEN_PACKAGES = {
  small: { tokens: 10, amount: 99, currency: 'RUB' },
  medium: { tokens: 50, amount: 399, currency: 'RUB' },
  large: { tokens: 100, amount: 699, currency: 'RUB' },
};

interface YooKassaWebhook {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    amount: {
      value: string;
      currency: string;
    };
    metadata?: {
      user_id?: string;
      plan?: string;
      package?: string;
      tokens?: string;
    };
  };
}

// Handle payment creation
async function handleCreatePayment(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  try {
    // Validate payload size (DoS protection)
    try {
      validatePayloadSize(request);
    } catch (error) {
      return response.status(413).json(
        errorResponse('Payload too large', 413)
      );
    }

    // Get authenticated user (verifies auth and gets/creates user atomically)
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse());
    }

    const { user } = authenticatedUser;

    // Validate and extract request body
    validateRequestBody(request);
    const body = getRequestBody<CreatePaymentRequestBody>(request);
    
    if (!validateCreatePaymentRequest(body)) {
      return response.status(400).json(
        errorResponse('Invalid package. Must be "small", "medium", or "large"', 400)
      );
    }

    const { package: packageName } = body;

    const packageInfo = TOKEN_PACKAGES[packageName as keyof typeof TOKEN_PACKAGES];
    const returnUrl = request.body.returnUrl || `${request.headers.origin || ''}/payment/success`;

    // Create payment with ЮKassa
    // Note: This requires ЮKassa SDK to be properly configured
    const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
    const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      return response.status(500).json(
        errorResponse('Payment system not configured', 500)
      );
    }

    // Create payment request
    // In production, use actual ЮKassa SDK
    const paymentData = {
      amount: {
        value: packageInfo.amount.toFixed(2),
        currency: packageInfo.currency,
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      capture: true,
      description: `DreamLens AI: ${packageInfo.tokens} токенов`,
      metadata: {
        user_id: user.id,
        package: packageName,
        tokens: packageInfo.tokens,
      },
    };

    // Make request to ЮKassa API
    const yookassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': `${user.id}-${Date.now()}`,
        'Authorization': `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!yookassaResponse.ok) {
      const error = await yookassaResponse.json();
      logger.error('ЮKassa API error', new Error(JSON.stringify(error)), {
        userId: user.id.substring(0, 8) + '...',
        packageName,
        status: yookassaResponse.status,
      });
      return response.status(500).json(
        errorResponse('Failed to create payment', 500)
      );
    }

    const payment = await yookassaResponse.json();

    // Store payment in database
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, currency, status, token_package, tokens_amount)
      VALUES (${user.id}, ${payment.id}, ${packageInfo.amount}, ${packageInfo.currency}, ${payment.status}, ${packageName}, ${packageInfo.tokens})
    `;

    return response.status(200).json(
      successResponse({
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        status: payment.status,
      })
    );
  } catch (error) {
    logger.logApiError('createPayment', error instanceof Error ? error : new Error(String(error)), {
      packageName: (request.body as CreatePaymentRequestBody | undefined)?.package,
    });
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}

// Handle webhook
async function handleWebhook(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  try {
    // Validate payload size (DoS protection)
    try {
      validatePayloadSize(request);
    } catch (error) {
      return response.status(413).json(
        errorResponse('Payload too large', 413)
      );
    }

    // Validate Content-Type header for webhook security
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      logger.logApiError('webhook', new Error('Invalid Content-Type header'), {
        contentType: contentType || 'missing',
      });
      return response.status(400).json(
        errorResponse('Invalid Content-Type. Expected application/json', 400)
      );
    }

    // Verify webhook signature for security
    const signature = request.headers['x-yookassa-signature'] as string | undefined;
    const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

    // In production, signature is required
    if (process.env.NODE_ENV === 'production') {
      if (!signature || !YOOKASSA_SECRET_KEY) {
        logger.logApiError('webhook', new Error('Missing webhook signature in production'), {
          hasSignature: !!signature,
          hasSecretKey: !!YOOKASSA_SECRET_KEY,
        });
        return response.status(401).json(
          errorResponse('Webhook signature required', 401)
        );
      }

      // Validate signature format (hex string, 64 characters for SHA256)
      if (!/^[a-f0-9]{64}$/i.test(signature)) {
        logger.logApiError('webhook', new Error('Invalid webhook signature format'), {
          signatureLength: signature.length,
        });
        return response.status(401).json(
          errorResponse('Invalid webhook signature format', 401)
        );
      }
    }

    // Verify signature if provided
    if (signature && YOOKASSA_SECRET_KEY) {
      const body = JSON.stringify(request.body);
      const expectedSignature = crypto
        .createHmac('sha256', YOOKASSA_SECRET_KEY)
        .update(body)
        .digest('hex');
      
      // Use crypto.timingSafeEqual for constant-time comparison
      // Convert hex strings to Buffers for comparison
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      // Check length first (before timing-safe comparison)
      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.logApiError('webhook', new Error('Invalid webhook signature length'), {
          hasSignature: !!signature,
        });
        return response.status(401).json(
          errorResponse('Invalid webhook signature', 401)
        );
      }
      
      // Use timing-safe comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.logApiError('webhook', new Error('Invalid webhook signature'), {
          hasSignature: !!signature,
        });
        return response.status(401).json(
          errorResponse('Invalid webhook signature', 401)
        );
      }
    }

    const webhook: YooKassaWebhook = request.body;

    // Handle payment.succeeded event
    if (webhook.event === 'payment.succeeded' && webhook.object.status === 'succeeded') {
      const paymentId = webhook.object.id;
      const userId = webhook.object.metadata?.user_id;
      const packageName = webhook.object.metadata?.package;
      const tokensAmount = webhook.object.metadata?.tokens;

      if (!userId) {
        logger.logApiError('webhook', new Error('Missing user_id in webhook metadata'), {
          paymentId: webhook.object.id,
          event: webhook.event,
        });
        return response.status(400).json({ error: 'Invalid webhook data' });
      }

      // Check if payment was already processed (idempotency check)
      const existingPayment = await sql<{ status: string; id: string }>`
        SELECT status, id FROM payments
        WHERE yookassa_payment_id = ${paymentId}
        LIMIT 1
      `;

      if (existingPayment.rows.length > 0) {
        // Payment already exists - check if already processed
        if (existingPayment.rows[0].status === 'succeeded') {
          logger.logApiInfo('webhook', {
            message: 'Payment already processed (idempotency)',
            paymentId,
            userId: userId.substring(0, 8) + '...',
          });
          // Return success to acknowledge webhook, but don't process again
          return response.status(200).json({ received: true, alreadyProcessed: true });
        }
      }

      // Update payment status atomically
      const updateResult = await sql<{ id: string; status: string }>`
        UPDATE payments
        SET status = 'succeeded'
        WHERE yookassa_payment_id = ${paymentId}
          AND (status IS NULL OR status != 'succeeded')
        RETURNING id, status
      `;

      // Only add tokens if payment was actually updated (not already succeeded)
      if (updateResult.rows.length > 0 && packageName && tokensAmount) {
        const tokens = parseInt(tokensAmount, 10);
        if (!isNaN(tokens) && tokens > 0) {
          await TokenService.addTokens(
            userId,
            tokens,
            'purchase',
            `Purchase: ${packageName} package (${tokens} tokens)`
          );
          logger.logApiInfo('webhook', {
            message: `Added ${tokens} tokens to user`,
            userId: userId.substring(0, 8) + '...',
            packageName,
            tokens,
            paymentId,
          });
        }
      } else if (updateResult.rows.length === 0) {
        // Payment was already processed (race condition protection)
        logger.logApiInfo('webhook', {
          message: 'Payment already processed (race condition)',
          paymentId,
          userId: userId.substring(0, 8) + '...',
        });
      }
    }

    // Handle payment.canceled event
    if (webhook.event === 'payment.canceled') {
      const paymentId = webhook.object.id;
      
      await sql`
        UPDATE payments
        SET status = 'canceled'
        WHERE yookassa_payment_id = ${paymentId}
      `;
    }

    // Always return 200 to acknowledge webhook
    return response.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDatabaseError = 
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('database') ||
      errorMessage.includes('relation') ||
      errorMessage.includes('POSTGRES') ||
      errorMessage.includes('DATABASE');
    
    logger.logApiError('Payment webhook processing', error instanceof Error ? error : new Error(String(error)), {
      event: (request.body as YooKassaWebhook | undefined)?.event,
      isDatabaseError,
    });
    
    // Return 500 for database errors to allow payment provider to retry
    // Return 200 for other errors to prevent retries on invalid data
    if (isDatabaseError) {
      return response.status(500).json({ received: false, error: 'Database error - will retry' });
    }
    
    // For non-database errors, return 200 to acknowledge and prevent retries
    return response.status(200).json({ received: true, error: 'Processing failed' });
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Get the route parameter from the dynamic route
  const route = (request.query?.route as string) || '';

  // Check if this is a webhook request
  // Webhook requests have specific headers or body structure
  const hasWebhookSignature = request.headers['x-yookassa-signature'];
  const isWebhookBody = request.body && typeof request.body === 'object' && 'event' in request.body;

  if (route === 'webhook' || hasWebhookSignature || isWebhookBody) {
    return handleWebhook(request, response);
  } else {
    // Default to create payment for /api/payments/create or /api/payments
    return handleCreatePayment(request, response);
  }
}

