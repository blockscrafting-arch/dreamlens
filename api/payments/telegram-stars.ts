/**
 * POST /api/payments/telegram-stars - Create Telegram Stars invoice
 * 
 * Creates an invoice link using Telegram Bot API for Telegram Stars payments
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as AuthService from '../services/auth.service.js';
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
import { sql } from '../repositories/database.js';

// Token packages pricing in Telegram Stars
// 1 Star ≈ 1.6-1.7 RUB (official Telegram rate)
// Prices adjusted for parity with RUB prices
const TOKEN_PACKAGES_STARS = {
  small: { tokens: 10, stars: 75 },    // ~120₽ (vs 99₽ in RUB)
  medium: { tokens: 50, stars: 300 },  // ~480₽ (vs 399₽ in RUB)
  large: { tokens: 100, stars: 500 },  // ~800₽ (vs 699₽ in RUB)
};

/**
 * Create Telegram Stars invoice
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate payload size (DoS protection)
    try {
      validatePayloadSize(request);
    } catch (error) {
      return response.status(413).json(
        errorResponse('Payload too large', 413)
      );
    }

    // Get authenticated user (must be Telegram user)
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse());
    }

    const { user, authType } = authenticatedUser;

    // Only Telegram users can use Telegram Stars
    if (authType !== 'telegram') {
      return response.status(403).json(
        errorResponse('Telegram Stars payments are only available for Telegram users', 403)
      );
    }

    // Validate and extract request body
    validateRequestBody(request);
    const body = getRequestBody<CreatePaymentRequestBody>(request);
    
    if (!validateCreatePaymentRequest(body)) {
      return response.status(400).json(
        errorResponse('Invalid package. Must be "small", "medium", or "large"', 400)
      );
    }

    const { package: packageName } = body;
    const packageInfo = TOKEN_PACKAGES_STARS[packageName as keyof typeof TOKEN_PACKAGES_STARS];

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!TELEGRAM_BOT_TOKEN) {
      logger.logApiError('telegram-stars', new Error('TELEGRAM_BOT_TOKEN not configured'), {
        userId: user.id.substring(0, 8) + '...',
      });
      return response.status(500).json(
        errorResponse('Payment system not configured', 500)
      );
    }

    // Create invoice using Telegram Bot API
    // We use createInvoiceLink for Mini Apps
    const invoicePayload = {
      title: `DreamLens AI: ${packageInfo.tokens} токенов`,
      description: `Покупка ${packageInfo.tokens} токенов для генерации изображений`,
      payload: JSON.stringify({
        user_id: user.id,
        package: packageName,
        tokens: packageInfo.tokens,
      }),
      provider_token: '', // Not needed for Stars
      currency: 'XTR', // Telegram Stars currency code
      prices: [
        {
          label: `${packageInfo.tokens} токенов`,
          amount: packageInfo.stars, // Amount in stars (XTR currency uses stars directly, not cents)
        },
      ],
      max_tip_amount: 0,
      suggested_tip_amounts: [],
      provider_data: JSON.stringify({
        user_id: user.id,
        package: packageName,
        tokens: packageInfo.tokens,
      }),
      photo_url: '', // Optional: add app icon URL
      photo_size: 0,
      photo_width: 0,
      photo_height: 0,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      send_phone_number_to_provider: false,
      send_email_to_provider: false,
      is_flexible: false,
    };

    // Call Telegram Bot API createInvoiceLink
    const botApiResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!botApiResponse.ok) {
      const error = await botApiResponse.json();
      logger.logApiError('Telegram Bot API error', new Error(JSON.stringify(error)), {
        userId: user.id.substring(0, 8) + '...',
        packageName,
        status: botApiResponse.status,
      });
      return response.status(500).json(
        errorResponse('Failed to create invoice', 500)
      );
    }

    const invoiceData = await botApiResponse.json();

    if (!invoiceData.ok || !invoiceData.result) {
      logger.logApiError('Telegram invoice creation failed', new Error(JSON.stringify(invoiceData)), {
        userId: user.id.substring(0, 8) + '...',
        packageName,
      });
      return response.status(500).json(
        errorResponse('Failed to create invoice', 500)
      );
    }

    const invoiceLink = invoiceData.result;

    // Store pending payment in database
    // Note: We'll use a special identifier for Telegram Stars payments
    const telegramPaymentId = `telegram_stars_${Date.now()}_${user.id.substring(0, 8)}`;
    
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, currency, status, token_package, tokens_amount)
      VALUES (${user.id}, ${telegramPaymentId}, ${packageInfo.stars}, 'XTR', 'pending', ${packageName}, ${packageInfo.tokens})
    `;

    logger.logApiInfo('telegram-stars', {
      message: 'Invoice created successfully',
      userId: user.id.substring(0, 8) + '...',
      packageName,
      stars: packageInfo.stars,
      tokens: packageInfo.tokens,
    });

    return response.status(200).json(
      successResponse({
        invoiceLink,
        package: packageName,
        stars: packageInfo.stars,
        tokens: packageInfo.tokens,
      })
    );
  } catch (error) {
    logger.logApiError('telegram-stars', error instanceof Error ? error : new Error(String(error)), {
      packageName: (request.body as CreatePaymentRequestBody | undefined)?.package,
    });
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}
