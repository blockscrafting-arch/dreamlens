/**
 * GET /api/admin/db-check - Comprehensive database health check
 * Protected by DB_INIT_SECRET environment variable
 * 
 * This endpoint performs a comprehensive check of database:
 * - Connection test and latency measurement
 * - Table existence verification
 * - Column existence verification (comparing with schema.ts)
 * - Index and trigger verification
 * - Data integrity checks
 * - Statistics collection
 * 
 * Usage:
 *   GET /api/admin/db-check
 *   Header: X-DB-Init-Secret: YOUR_SECRET
 *   or
 *   GET /api/admin/db-check?secret=YOUR_SECRET
 *   
 *   To force database initialization/migration:
 *   GET /api/admin/db-check?secret=YOUR_SECRET&fix=true
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../repositories/database.js';
import { initDatabase } from '../repositories/database.js';
import { logger } from '../utils/logger.js';

interface TableCheck {
  name: string;
  exists: boolean;
  columns?: string[];
  missingColumns?: string[];
  rowCount?: number;
}

interface IndexCheck {
  name: string;
  exists: boolean;
  table: string;
}

interface TriggerCheck {
  name: string;
  exists: boolean;
  table: string;
}

interface IntegrityIssue {
  table: string;
  issue: string;
  count?: number;
}

interface DbCheckResult {
  success: boolean;
  timestamp: string;
  initialization?: {
    attempted: boolean;
    success: boolean;
    error?: string;
  };
  connectivity: {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  };
  tables: TableCheck[];
  indexes: IndexCheck[];
  triggers: TriggerCheck[];
  integrity: {
    status: 'healthy' | 'issues_found';
    issues: IntegrityIssue[];
  };
  statistics: {
    users: number;
    subscriptions: number;
    generations: number;
    usageLogs: number;
    payments: number;
    userTokens: number;
    tokenTransactions: number;
  };
  schemaSync: {
    status: 'synced' | 'out_of_sync';
    missingColumns: Array<{ table: string; column: string }>;
  };
}

// Expected schema from schema.ts
const EXPECTED_SCHEMA = {
  users: ['id', 'clerk_id', 'device_id', 'email', 'telegram_id', 'first_name', 'last_name', 'username', 'photo_url', 'language_code', 'vk_id', 'yandex_id', 'password_hash', 'created_at', 'updated_at'],
  subscriptions: ['id', 'user_id', 'plan', 'status', 'current_period_start', 'current_period_end', 'yookassa_subscription_id', 'created_at', 'updated_at'],
  generations: ['id', 'user_id', 'image_url', 'prompt_used', 'trend', 'quality', 'status', 'error_message', 'created_at', 'updated_at'],
  usage_logs: ['id', 'user_id', 'action', 'ip_address', 'created_at'],
  payments: ['id', 'user_id', 'yookassa_payment_id', 'amount', 'currency', 'status', 'token_package', 'tokens_amount', 'created_at'],
  user_tokens: ['id', 'user_id', 'balance', 'last_bonus_date', 'created_at', 'updated_at'],
  token_transactions: ['id', 'user_id', 'amount', 'type', 'description', 'created_at'],
};

const EXPECTED_INDEXES = [
  { name: 'idx_users_clerk_id', table: 'users' },
  { name: 'idx_users_device_id', table: 'users' },
  { name: 'users_telegram_id_unique', table: 'users' },
  { name: 'idx_users_vk_id', table: 'users' },
  { name: 'idx_users_yandex_id', table: 'users' },
  { name: 'idx_subscriptions_user_id', table: 'subscriptions' },
  { name: 'idx_subscriptions_status', table: 'subscriptions' },
  { name: 'idx_unique_active_subscription', table: 'subscriptions' },
  { name: 'idx_generations_user_id', table: 'generations' },
  { name: 'idx_generations_created_at', table: 'generations' },
  { name: 'idx_usage_logs_user_id', table: 'usage_logs' },
  { name: 'idx_usage_logs_created_at', table: 'usage_logs' },
  { name: 'idx_usage_logs_ip_address', table: 'usage_logs' },
  { name: 'idx_usage_logs_rate_limit', table: 'usage_logs' },
  { name: 'idx_payments_user_id', table: 'payments' },
  { name: 'idx_payments_yookassa_id', table: 'payments' },
  { name: 'idx_payments_status', table: 'payments' },
  { name: 'idx_user_tokens_user_id', table: 'user_tokens' },
  { name: 'idx_token_transactions_user_id', table: 'token_transactions' },
  { name: 'idx_token_transactions_created_at', table: 'token_transactions' },
  { name: 'idx_token_transactions_type', table: 'token_transactions' },
  { name: 'idx_token_transactions_bonus_check', table: 'token_transactions' },
  { name: 'idx_daily_bonus_once', table: 'token_transactions' },
];

const EXPECTED_TRIGGERS = [
  { name: 'trigger_initialize_new_user', table: 'users' },
];

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    // Get secret from query parameter or header
    const secretFromQuery = typeof request.query.secret === 'string' ? request.query.secret : null;
    const secretFromHeader = request.headers['x-db-init-secret'] as string | undefined;
    const providedSecret = secretFromQuery || secretFromHeader;

    // Get expected secret from environment
    const expectedSecret = process.env.DB_INIT_SECRET;

    // Check if secret is configured
    if (!expectedSecret) {
      logger.logApiError('db-check', new Error('DB_INIT_SECRET not configured'), {});
      return response.status(500).json({
        success: false,
        error: 'Database check is not configured. Please set DB_INIT_SECRET environment variable.',
      });
    }

    // Verify secret
    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.logApiError('db-check', new Error('Invalid secret provided'), {
        hasSecret: !!providedSecret,
      });
      return response.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid secret.',
      });
    }

    logger.logApiRequest('db-check', { method: request.method });

    // Check if fix parameter is present
    const shouldFix = request.query.fix === 'true';
    
    const result: DbCheckResult = {
      success: true,
      timestamp: new Date().toISOString(),
      connectivity: {
        status: 'unhealthy',
      },
      tables: [],
      indexes: [],
      triggers: [],
      integrity: {
        status: 'healthy',
        issues: [],
      },
      statistics: {
        users: 0,
        subscriptions: 0,
        generations: 0,
        usageLogs: 0,
        payments: 0,
        userTokens: 0,
        tokenTransactions: 0,
      },
      schemaSync: {
        status: 'synced',
        missingColumns: [],
      },
    };

    // 0. Force database initialization if fix=true
    if (shouldFix) {
      result.initialization = {
        attempted: true,
        success: false,
      };
      try {
        logger.logApiInfo('db-check - forcing database initialization', {});
        await initDatabase();
        result.initialization.success = true;
        logger.logApiInfo('db-check - database initialization completed successfully', {});
      } catch (error) {
        result.initialization.error = error instanceof Error ? error.message : String(error);
        result.success = false;
        logger.logApiError('db-check - database initialization failed', error instanceof Error ? error : new Error(String(error)));
        // Continue with checks even if initialization failed
      }
    }

    // 1. Connectivity test
    try {
      const startTime = Date.now();
      await sql`SELECT 1 as health_check`;
      const latency = Date.now() - startTime;
      result.connectivity = {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      result.connectivity = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
      result.success = false;
      logger.logApiError('db-check - connectivity', error instanceof Error ? error : new Error(String(error)));
      return response.status(503).json(result);
    }

    // 2. Check tables and columns
    for (const [tableName, expectedColumns] of Object.entries(EXPECTED_SCHEMA)) {
      try {
        // Check if table exists
        const tableExistsResult = await sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          ) as exists
        `;
        const tableExists = tableExistsResult.rows[0]?.exists === true;

        if (!tableExists) {
          result.tables.push({
            name: tableName,
            exists: false,
          });
          result.success = false;
          result.schemaSync.status = 'out_of_sync';
          continue;
        }

        // Get actual columns
        const columnsResult = await sql<{ column_name: string }>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        const actualColumns = columnsResult.rows.map(row => row.column_name);
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

        // Get row count
        const countResult = await sql<{ count: string }>`
          SELECT COUNT(*) as count FROM ${sql.raw(tableName)}
        `;
        const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);

        // Update statistics
        const statsKey = tableName === 'usage_logs' ? 'usageLogs' : 
                        tableName === 'user_tokens' ? 'userTokens' :
                        tableName === 'token_transactions' ? 'tokenTransactions' :
                        tableName as keyof typeof result.statistics;
        if (statsKey in result.statistics) {
          result.statistics[statsKey as keyof typeof result.statistics] = rowCount;
        }

        result.tables.push({
          name: tableName,
          exists: true,
          columns: actualColumns,
          missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
          rowCount,
        });

        if (missingColumns.length > 0) {
          result.success = false;
          result.schemaSync.status = 'out_of_sync';
          result.schemaSync.missingColumns.push(
            ...missingColumns.map(col => ({ table: tableName, column: col }))
          );
        }
      } catch (error) {
        logger.logApiError(`db-check - table ${tableName}`, error instanceof Error ? error : new Error(String(error)));
        result.tables.push({
          name: tableName,
          exists: false,
        });
        result.success = false;
      }
    }

    // 3. Check indexes
    for (const index of EXPECTED_INDEXES) {
      try {
        const indexResult = await sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = ${index.table}
            AND indexname = ${index.name}
          ) as exists
        `;
        result.indexes.push({
          name: index.name,
          table: index.table,
          exists: indexResult.rows[0]?.exists === true,
        });
        if (!indexResult.rows[0]?.exists) {
          result.success = false;
        }
      } catch (error) {
        logger.logApiError(`db-check - index ${index.name}`, error instanceof Error ? error : new Error(String(error)));
        result.indexes.push({
          name: index.name,
          table: index.table,
          exists: false,
        });
        result.success = false;
      }
    }

    // 4. Check triggers
    for (const trigger of EXPECTED_TRIGGERS) {
      try {
        const triggerResult = await sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT FROM pg_trigger
            WHERE tgname = ${trigger.name}
          ) as exists
        `;
        result.triggers.push({
          name: trigger.name,
          table: trigger.table,
          exists: triggerResult.rows[0]?.exists === true,
        });
        if (!triggerResult.rows[0]?.exists) {
          result.success = false;
        }
      } catch (error) {
        logger.logApiError(`db-check - trigger ${trigger.name}`, error instanceof Error ? error : new Error(String(error)));
        result.triggers.push({
          name: trigger.name,
          table: trigger.table,
          exists: false,
        });
        result.success = false;
      }
    }

    // 5. Integrity checks
    try {
      // Check for orphaned user_tokens (user_id doesn't exist in users)
      const orphanedTokensResult = await sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM user_tokens ut
        LEFT JOIN users u ON ut.user_id = u.id
        WHERE u.id IS NULL
      `;
      const orphanedTokensCount = parseInt(orphanedTokensResult.rows[0]?.count || '0', 10);
      if (orphanedTokensCount > 0) {
        result.integrity.issues.push({
          table: 'user_tokens',
          issue: `Found ${orphanedTokensCount} orphaned records (user_id doesn't exist in users)`,
          count: orphanedTokensCount,
        });
        result.integrity.status = 'issues_found';
        result.success = false;
      }

      // Check for orphaned token_transactions
      const orphanedTransactionsResult = await sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM token_transactions tt
        LEFT JOIN users u ON tt.user_id = u.id
        WHERE u.id IS NULL
      `;
      const orphanedTransactionsCount = parseInt(orphanedTransactionsResult.rows[0]?.count || '0', 10);
      if (orphanedTransactionsCount > 0) {
        result.integrity.issues.push({
          table: 'token_transactions',
          issue: `Found ${orphanedTransactionsCount} orphaned records (user_id doesn't exist in users)`,
          count: orphanedTransactionsCount,
        });
        result.integrity.status = 'issues_found';
        result.success = false;
      }

      // Check for users without user_tokens record
      const usersWithoutTokensResult = await sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN user_tokens ut ON u.id = ut.user_id
        WHERE ut.user_id IS NULL
      `;
      const usersWithoutTokensCount = parseInt(usersWithoutTokensResult.rows[0]?.count || '0', 10);
      if (usersWithoutTokensCount > 0) {
        result.integrity.issues.push({
          table: 'users',
          issue: `Found ${usersWithoutTokensCount} users without user_tokens record`,
          count: usersWithoutTokensCount,
        });
        result.integrity.status = 'issues_found';
        // Note: This might be expected for newly created users, so we don't mark as failure
      }
    } catch (error) {
      logger.logApiError('db-check - integrity', error instanceof Error ? error : new Error(String(error)));
      result.integrity.issues.push({
        table: 'unknown',
        issue: `Integrity check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      result.integrity.status = 'issues_found';
    }

    const statusCode = result.success ? 200 : 503;
    return response.status(statusCode).json(result);
  } catch (error) {
    logger.logApiError('db-check', error instanceof Error ? error : new Error(String(error)), {});
    
    return response.status(500).json({
      success: false,
      error: 'Failed to perform database check',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
