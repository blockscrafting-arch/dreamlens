/**
 * POST /api/payments/telegram-webhook - Webhook handler for Telegram payment updates
 * 
 * Handles successful_payment updates from Telegram Bot API
 * This endpoint should be registered with Telegram Bot API setWebhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import * as TokenService from '../services/token.service.js';
import { logger } from '../utils/logger.js';
import { setCorsHeaders } from '../utils/cors.js';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: {
      id: number;
    };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

/**
 * Handle successful payment
 */
async function handleSuccessfulPayment(
  message: TelegramUpdate['message'],
  response: VercelResponse
) {
  if (!message?.successful_payment || !message.from) {
    return response.status(400).json({ error: 'Invalid payment data' });
  }

  const payment = message.successful_payment;
  const telegramUserId = String(message.from.id);

  try {
    // Parse invoice payload
    let payload: {
      user_id?: string;
      package?: string;
      tokens?: number;
    };

    try {
      payload = JSON.parse(payment.invoice_payload);
    } catch (error) {
      logger.logApiError('telegram-webhook', error instanceof Error ? error : new Error(String(error)), {
        invoicePayload: payment.invoice_payload,
      });
      return response.status(400).json({ error: 'Invalid invoice payload' });
    }

    const userId = payload.user_id;
    const packageName = payload.package;
    const tokens = payload.tokens;

    if (!userId || !packageName || !tokens) {
      logger.logApiError('telegram-webhook', new Error('Missing required payment data'), {
        userId: !!userId,
        packageName: !!packageName,
        tokens: !!tokens,
      });
      return response.status(400).json({ error: 'Missing required payment data' });
    }

    // Find user by Telegram ID
    const userResult = await sql<{ id: string }>`
      SELECT id FROM users
      WHERE telegram_id = ${telegramUserId}
      LIMIT 1
    `;

    if (userResult.rows.length === 0) {
      logger.logApiError('telegram-webhook', new Error('User not found'), {
        telegramUserId,
      });
      return response.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify user_id matches
    if (user.id !== userId) {
      logger.logApiError('telegram-webhook', new Error('User ID mismatch'), {
        userId,
        telegramUserId,
        foundUserId: user.id,
      });
      return response.status(400).json({ error: 'User ID mismatch' });
    }

    // Check if payment was already processed (idempotency)
    const paymentId = `telegram_stars_${payment.telegram_payment_charge_id}`;
    const existingPayment = await sql<{ status: string; id: string }>`
      SELECT status, id FROM payments
      WHERE yookassa_payment_id = ${paymentId}
      LIMIT 1
    `;

    if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'succeeded') {
      logger.logApiInfo('telegram-webhook', {
        message: 'Payment already processed (idempotency)',
        paymentId,
        userId: userId.substring(0, 8) + '...',
      });
      return response.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Update or create payment record
    // For XTR currency, total_amount is already in stars (not in smallest units)
    await sql`
      INSERT INTO payments (user_id, yookassa_payment_id, amount, currency, status, token_package, tokens_amount)
      VALUES (${userId}, ${paymentId}, ${payment.total_amount}, 'XTR', 'succeeded', ${packageName}, ${tokens})
      ON CONFLICT (yookassa_payment_id) DO UPDATE
      SET status = 'succeeded'
      WHERE payments.status != 'succeeded'
    `;

    // Add tokens to user account
    await TokenService.addTokens(
      userId,
      tokens,
      'purchase',
      `Telegram Stars purchase: ${packageName} package (${tokens} tokens)`
    );

    logger.logApiInfo('telegram-webhook', {
      message: `Added ${tokens} tokens to user via Telegram Stars`,
      userId: userId.substring(0, 8) + '...',
      packageName,
      tokens,
      paymentId,
      stars: payment.total_amount, // For XTR currency, total_amount is already in stars
    });

    return response.status(200).json({ received: true, processed: true });
  } catch (error) {
    logger.logApiError('telegram-webhook', error instanceof Error ? error : new Error(String(error)), {
      telegramUserId,
    });
    return response.status(500).json({ received: false, error: 'Processing failed' });
  }
}

/**
 * Handle pre-checkout query (optional validation before payment)
 */
async function handlePreCheckoutQuery(
  query: TelegramUpdate['pre_checkout_query'],
  response: VercelResponse
) {
  if (!query) {
    return response.status(400).json({ error: 'Invalid pre-checkout query' });
  }

  // For now, we always approve pre-checkout queries
  // In the future, you could add validation here (e.g., check user balance, availability, etc.)
  
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    return response.status(500).json({ error: 'Bot token not configured' });
  }

  // Answer pre-checkout query
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pre_checkout_query_id: query.id,
      ok: true,
    }),
  });

  return response.status(200).json({ received: true });
}

/**
 * Verify webhook secret (optional, for additional security)
 */
function verifyWebhookSecret(request: VercelRequest): boolean {
  const secret = request.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    // If no secret is configured, allow all requests (not recommended for production)
    return true;
  }

  return secret === expectedSecret;
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

  try {
    // Verify webhook secret if configured
    if (!verifyWebhookSecret(request)) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Validate payload size
    const contentLength = request.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      return response.status(413).json({ error: 'Payload too large' });
    }

    const update: TelegramUpdate = request.body;

    // Handle successful payment
    if (update.message?.successful_payment) {
      return handleSuccessfulPayment(update.message, response);
    }

    // Handle pre-checkout query
    if (update.pre_checkout_query) {
      return handlePreCheckoutQuery(update.pre_checkout_query, response);
    }

    // Unknown update type - acknowledge but don't process
    logger.logApiInfo('telegram-webhook', {
      message: 'Unknown update type received',
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasPreCheckoutQuery: !!update.pre_checkout_query,
    });

    return response.status(200).json({ received: true, ignored: true });
  } catch (error) {
    logger.logApiError('telegram-webhook', error instanceof Error ? error : new Error(String(error)), {});
    return response.status(500).json({ received: false, error: 'Processing failed' });
  }
}
