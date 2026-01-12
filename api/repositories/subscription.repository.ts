/**
 * Subscription Repository
 * Data access layer for subscriptions - only SQL queries, no business logic
 */

import { sql } from './database.js';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_start: Date | null;
  current_period_end: Date | null;
  yookassa_subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get user subscription
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const result = await sql<Subscription>`
    SELECT * FROM subscriptions 
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return result.rows[0] || null;
}

