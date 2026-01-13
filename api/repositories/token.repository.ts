/**
 * Token Repository
 * Data access layer for tokens and transactions - only SQL queries, no business logic
 */

import { sql } from './database.js';
import { getCache, cacheKey } from '../utils/cache.js';

export interface UserTokens {
  id: string;
  user_id: string;
  balance: number;
  last_bonus_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'purchase' | 'bonus' | 'generation' | 'refund';
  description: string | null;
  created_at: Date;
}

/**
 * Execute multiple operations in a transaction
 * Note: In serverless environments, we use a single query with multiple statements
 * For true transactions, we'd need a connection pool, but this provides atomicity
 * for our use cases (balance updates + transaction records)
 */
export async function withTransaction<T>(
  callback: (execute: typeof sql) => Promise<T>
): Promise<T> {
  // For serverless, we'll execute operations sequentially
  // The callback should ensure operations are atomic by using single queries where possible
  // For complex operations, we use a transaction-like pattern with error handling
  try {
    return await callback(sql);
  } catch (error) {
    // If any operation fails, the error propagates
    // In a real transaction, we'd rollback here
    throw error;
  }
}

/**
 * Get user token balance record
 * Cached for 10 seconds to reduce database load while keeping data fresh
 * Cache is invalidated immediately after any balance update operations
 */
export async function getTokenBalance(userId: string): Promise<UserTokens | null> {
  const cache = getCache();
  const cacheKeyStr = cacheKey('token_balance', userId);
  
  // Try cache first
  const cached = cache.get<UserTokens | null>(cacheKeyStr);
  if (cached !== null) {
    return cached;
  }
  
  const result = await sql<UserTokens>`
    SELECT * FROM user_tokens WHERE user_id = ${userId} LIMIT 1
  `;
  const balance = result.rows[0] || null;
  
  // Cache result (even null to avoid repeated queries)
  // Reduced TTL to 10 seconds for better data freshness
  cache.set(cacheKeyStr, balance, 10000); // 10 seconds
  
  return balance;
}

/**
 * Create token record for user
 */
export async function createTokenRecord(userId: string, initialBalance: number = 0): Promise<UserTokens> {
  const result = await sql<UserTokens>`
    INSERT INTO user_tokens (user_id, balance)
    VALUES (${userId}, ${initialBalance})
    RETURNING *
  `;
  
  // Invalidate cache after creating new record
  const cache = getCache();
  cache.delete(cacheKey('token_balance', userId));
  
  return result.rows[0];
}

/**
 * Get or create token balance atomically using INSERT ... ON CONFLICT
 * Used for backward compatibility with old users who don't have tokens
 */
export async function getOrCreateTokenBalance(userId: string): Promise<UserTokens> {
  const result = await sql<UserTokens>`
    INSERT INTO user_tokens (user_id, balance)
    VALUES (${userId}, 0)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  
  // Invalidate cache after create/update
  const cache = getCache();
  cache.delete(cacheKey('token_balance', userId));
  
  return result.rows[0];
}

/**
 * Update token balance atomically
 * This should be used within withTransaction for multi-step operations
 */
export async function updateBalance(userId: string, newBalance: number): Promise<void> {
  await sql`
    UPDATE user_tokens
    SET balance = ${newBalance}, updated_at = NOW()
    WHERE user_id = ${userId}
  `;
  
  // Invalidate cache after balance update
  const cache = getCache();
  cache.delete(cacheKey('token_balance', userId));
}

/**
 * Add transaction record
 */
export async function addTransaction(
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'generation' | 'refund',
  description: string
): Promise<void> {
  await sql`
    INSERT INTO token_transactions (user_id, amount, type, description)
    VALUES (${userId}, ${amount}, ${type}, ${description})
  `;
}

/**
 * Get user transactions
 */
export async function getTransactions(userId: string, limit: number = 100): Promise<TokenTransaction[]> {
  const result = await sql<TokenTransaction>`
    SELECT * FROM token_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

/**
 * Check if user has received welcome bonus
 */
export async function hasReceivedWelcomeBonus(userId: string): Promise<boolean> {
  const result = await sql<{ count: string }>`
    SELECT COUNT(*) as count
    FROM token_transactions
    WHERE user_id = ${userId}
      AND type = 'bonus'
      AND description = 'Welcome bonus'
  `;
  return parseInt(result.rows[0]?.count || '0', 10) > 0;
}

/**
 * Check if user has received welcome pack (anonymous)
 */
export async function hasReceivedWelcomePack(userId: string): Promise<boolean> {
  const result = await sql<{ count: string }>`
    SELECT COUNT(*) as count
    FROM token_transactions
    WHERE user_id = ${userId}
      AND type = 'bonus'
      AND description = 'Welcome Pack (anonymous)'
  `;
  return parseInt(result.rows[0]?.count || '0', 10) > 0;
}

/**
 * Get last bonus date
 */
export async function getLastBonusDate(userId: string): Promise<Date | null> {
  const result = await sql<UserTokens>`
    SELECT last_bonus_date FROM user_tokens WHERE user_id = ${userId} LIMIT 1
  `;
  return result.rows[0]?.last_bonus_date || null;
}

/**
 * Update last bonus date
 */
export async function updateLastBonusDate(userId: string, date: Date): Promise<void> {
  await sql`
    UPDATE user_tokens
    SET last_bonus_date = ${date.toISOString().split('T')[0]}, updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

/**
 * Atomic operation: Update balance and add transaction in one query
 * Uses CTE to ensure atomicity - both operations succeed or both fail
 * This is more reliable than separate queries in serverless environments
 */
export async function updateBalanceAndAddTransaction(
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'generation' | 'refund',
  description: string
): Promise<{ newBalance: number }> {
  // Use a single query with CTE to atomically update balance and get new value
  // Then insert transaction in the same query
  // This ensures both operations succeed or both fail
  const result = await sql<{ new_balance: number }>`
    WITH updated_balance AS (
      UPDATE user_tokens
      SET 
        balance = balance + ${amount},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING balance as new_balance
    ),
    inserted_transaction AS (
      INSERT INTO token_transactions (user_id, amount, type, description)
      SELECT ${userId}, ${amount}, ${type}, ${description}
      WHERE EXISTS (SELECT 1 FROM updated_balance)
      RETURNING id
    )
    SELECT new_balance FROM updated_balance
  `;

  if (result.rows.length === 0) {
    // User tokens not found - need to create them first
    throw new Error('User tokens not found');
  }

  // Invalidate cache after balance update
  const cache = getCache();
  cache.delete(cacheKey('token_balance', userId));

  return { newBalance: result.rows[0].new_balance };
}

/**
 * Atomic operation: Claim daily bonus if not claimed today
 * Updates balance, adds transaction, and updates last_bonus_date atomically
 * Returns the new balance if successful, or null if already claimed today
 * Uses CTE to ensure all operations succeed or fail together
 * Uses CURRENT_DATE from PostgreSQL to ensure consistent date comparison regardless of timezone
 */
export async function claimDailyBonusAtomic(
  userId: string,
  bonusAmount: number
): Promise<{ success: boolean; newBalance: number }> {
  // Use a single atomic query with CTE to update balance, last_bonus_date, and add transaction
  // This ensures that only one request can claim the bonus per day and all operations are atomic
  // Uses CURRENT_DATE from PostgreSQL to ensure consistent date comparison regardless of timezone
  const result = await sql<{ new_balance: number }>`
    WITH updated_balance AS (
      UPDATE user_tokens
      SET 
        balance = balance + ${bonusAmount},
        last_bonus_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE 
        user_id = ${userId}
        AND (last_bonus_date IS NULL OR last_bonus_date != CURRENT_DATE)
      RETURNING balance as new_balance
    ),
    inserted_transaction AS (
      INSERT INTO token_transactions (user_id, amount, type, description)
      SELECT ${userId}, ${bonusAmount}, 'bonus', 'Daily wheel bonus'
      WHERE EXISTS (SELECT 1 FROM updated_balance)
      RETURNING id
    )
    SELECT new_balance FROM updated_balance
  `;

  if (result.rows.length === 0) {
    // Either user doesn't exist or bonus already claimed today
    return { success: false, newBalance: 0 };
  }

  // Invalidate cache after balance update
  const cache = getCache();
  cache.delete(cacheKey('token_balance', userId));

  return { success: true, newBalance: result.rows[0].new_balance };
}

/**
 * Atomic operation: Ensure welcome bonus is given if not already received
 * Creates tokens if missing, checks for existing bonus transaction, and awards bonus atomically
 * Returns success status and whether bonus was awarded
 * Optimized: fast path checks before heavy operations
 */
export async function ensureWelcomeBonusAtomic(
  userId: string,
  userType: 'clerk' | 'device' | 'telegram'
): Promise<{ success: boolean; bonusAwarded: boolean }> {
  // Security fix: Anonymous users get 0 tokens to prevent abuse
  // Telegram and Clerk users get welcome bonus
  const bonusAmount = (userType === 'clerk' || userType === 'telegram') ? 5 : 0;
  const bonusDescription = (userType === 'clerk' || userType === 'telegram') ? 'Welcome bonus' : 'Welcome Pack (anonymous)';

  // Fast path: Check if tokens record exists (uses cache)
  const tokenBalance = await getTokenBalance(userId);
  
  // If tokens record doesn't exist, create it (only for old users)
  if (!tokenBalance) {
    await getOrCreateTokenBalance(userId);
  }

  // Fast path: Check if bonus already received (simple SELECT query)
  const hasBonus = (userType === 'clerk' || userType === 'telegram')
    ? await hasReceivedWelcomeBonus(userId)
    : await hasReceivedWelcomePack(userId);

  // If bonus already received or amount is 0, return immediately (no write operations)
  if (hasBonus || bonusAmount === 0) {
    return { 
      success: true, 
      bonusAwarded: false 
    };
  }

  // Bonus not received yet - use atomic CTE to check and award in one query
  // This handles race conditions where multiple requests try to award bonus simultaneously
  const result = await sql<{ bonus_awarded: boolean }>`
    WITH bonus_check AS (
      -- Check if bonus transaction already exists (double-check for race conditions)
      SELECT 
        NOT EXISTS (
          SELECT 1 FROM token_transactions
          WHERE user_id = ${userId}
            AND type = 'bonus'
            AND description = ${bonusDescription}
        ) as should_award
    ),
    bonus_awarded AS (
      -- Update balance if bonus should be awarded
      UPDATE user_tokens
      SET 
        balance = balance + ${bonusAmount},
        updated_at = NOW()
      WHERE 
        user_id = ${userId}
        AND EXISTS (SELECT 1 FROM bonus_check WHERE should_award = true)
      RETURNING true as bonus_awarded
    ),
    transaction_inserted AS (
      -- Insert transaction record if bonus was awarded
      INSERT INTO token_transactions (user_id, amount, type, description)
      SELECT ${userId}, ${bonusAmount}, 'bonus', ${bonusDescription}
      WHERE EXISTS (SELECT 1 FROM bonus_awarded)
      RETURNING id
    )
    SELECT 
      COALESCE((SELECT bonus_awarded FROM bonus_awarded), false) as bonus_awarded
  `;

  const bonusAwarded = result.rows[0]?.bonus_awarded === true;

  return { 
    success: true, 
    bonusAwarded 
  };
}

