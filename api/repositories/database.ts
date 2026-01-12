/**
 * Database connection and initialization
 * Using Vercel Postgres client
 */

import { sql as vercelSql } from '@vercel/postgres';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { trackExecutionTime } from '../utils/metrics.js';

// Flag to track if we've attempted auto-initialization to prevent infinite loops
let autoInitAttempted = false;

/**
 * Marker interface for raw SQL strings that should be injected directly
 * without parameterization (use with caution - only for trusted identifiers)
 */
interface RawSql {
  readonly __rawSql: true;
  readonly value: string;
}

/**
 * Create a raw SQL marker for dynamic table/column names
 * WARNING: Only use with trusted identifiers (e.g., table names from whitelist)
 * Never use with user input to prevent SQL injection
 */
function raw(value: string): RawSql {
  return { __rawSql: true, value };
}

/**
 * Check if a value is a RawSql marker
 */
function isRawSql(value: unknown): value is RawSql {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__rawSql' in value &&
    (value as RawSql).__rawSql === true &&
    typeof (value as RawSql).value === 'string'
  );
}

/**
 * Process template strings and values to handle RawSql markers
 * Reconstructs the query by merging raw SQL strings into the template
 */
function processSqlTemplate(
  strings: TemplateStringsArray,
  values: unknown[]
): { processedStrings: TemplateStringsArray; processedValues: unknown[] } {
  // Check if any values are RawSql markers
  const hasRawSql = values.some(isRawSql);
  
  if (!hasRawSql) {
    // No RawSql markers, return as-is
    return { processedStrings: strings, processedValues: values };
  }
  
  // Reconstruct template strings and values
  // For template literal sql`...${value}...`, we have:
  // - strings[0], values[0], strings[1], values[1], ..., strings[n]
  const processedParts: string[] = [];
  const processedValues: unknown[] = [];
  
  // Start with first string
  let currentPart = strings[0];
  
  // Process each value and the string that follows it
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const nextString = strings[i + 1] || '';
    
    if (isRawSql(value)) {
      // Merge raw SQL into current part, then add next string
      currentPart += value.value + nextString;
    } else {
      // Regular value: finish current part, add value to processed values, start new part
      processedParts.push(currentPart);
      processedValues.push(value);
      currentPart = nextString;
    }
  }
  
  // Add the final part
  if (currentPart) {
    processedParts.push(currentPart);
  }
  
  // Convert to TemplateStringsArray
  const templateStringsArray = Object.assign(
    processedParts,
    { raw: processedParts }
  ) as TemplateStringsArray;
  
  return { processedStrings: templateStringsArray, processedValues };
}

/**
 * Check if error is a "relation does not exist" or "column does not exist" error
 * Drizzle ORM wraps the original database error in error.cause
 * This function detects schema errors that can be fixed by running migrations
 */
export function isRelationNotExistError(error: unknown): boolean {
  if (!error) return false;
  
  // Helper to extract error code from error object (PostgreSQL error codes)
  const getErrorCode = (err: unknown): string | undefined => {
    if (err && typeof err === 'object') {
      // Check for common error code properties
      if ('code' in err && typeof err.code === 'string') {
        return err.code;
      }
      // Check for PostgreSQL error code (often in 'code' or 'errno')
      if ('errno' in err && typeof err.errno === 'string') {
        return err.errno;
      }
    }
    return undefined;
  };
  
  // PostgreSQL error codes for schema errors:
  // 42P01 = relation does not exist
  // 42703 = undefined column
  // 42P16 = invalid column reference
  const schemaErrorCodes = ['42P01', '42703', '42P16'];
  const errorCode = getErrorCode(error);
  if (errorCode && schemaErrorCodes.includes(errorCode)) {
    return true;
  }
  
  // Helper to check if message indicates schema error
  const isSchemaError = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    return (
      // Relation/table does not exist
      (lowerMessage.includes('relation') && 
       (lowerMessage.includes('does not exist') || lowerMessage.includes('не существует'))) ||
      // Column does not exist
      (lowerMessage.includes('column') && 
       (lowerMessage.includes('does not exist') || lowerMessage.includes('не существует'))) ||
      // Alternative error formats
      (lowerMessage.includes('column') && lowerMessage.includes('missing')) ||
      // Drizzle/Vercel Postgres "Failed query" errors that indicate schema issues
      (lowerMessage.includes('failed query') && 
       (lowerMessage.includes('column') || lowerMessage.includes('relation'))) ||
      // Undefined column errors
      lowerMessage.includes('undefined column') ||
      // Invalid column reference
      lowerMessage.includes('invalid column')
    );
  };
  
  // Check error message
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (isSchemaError(errorMessage)) return true;
  
  // Check error.cause (where Drizzle stores the original error)
  if (error instanceof Error && error.cause) {
    const causeCode = getErrorCode(error.cause);
    if (causeCode && schemaErrorCodes.includes(causeCode)) {
      return true;
    }
    
    const causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
    if (isSchemaError(causeMessage)) return true;
    
    // Also check nested cause (in case of multiple wrappings)
    if (error.cause instanceof Error && error.cause.cause) {
      const nestedCauseCode = getErrorCode(error.cause.cause);
      if (nestedCauseCode && schemaErrorCodes.includes(nestedCauseCode)) {
        return true;
      }
      
      const nestedCauseMessage = error.cause.cause instanceof Error 
        ? error.cause.cause.message 
        : String(error.cause.cause);
      if (isSchemaError(nestedCauseMessage)) return true;
    }
  }
  
  return false;
}

/**
 * Normalize database result to expected format
 * Handles different result formats from Vercel Postgres
 */
function normalizeDbResult<T>(result: unknown): { rows: T[] } {
  // Verify result structure matches expected format
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) {
    return { rows: result.rows as T[] };
  }
  
  // Fallback: if result is an array, wrap it
  if (Array.isArray(result)) {
    return { rows: result as T[] };
  }
  
  // Unexpected format
  throw new Error('Unexpected database result format');
}

/**
 * Direct SQL execution with automatic database initialization
 * Use this for all database operations
 * Automatically initializes database schema if tables don't exist
 */
/**
 * Type-safe SQL value serializer
 * Validates that values can be safely serialized to SQL
 */
function serializeSqlValue(value: unknown): unknown {
  // Allow primitive types and null
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // For arrays and objects, let vercelSql handle serialization
  // but log a warning in development
  if (process.env.NODE_ENV === 'development' && (Array.isArray(value) || typeof value === 'object')) {
    logger.debug('Serializing complex value to SQL', { type: typeof value, isArray: Array.isArray(value) });
  }
  return value;
}

/**
 * Internal SQL execution helper that processes RawSql markers and executes the query
 */
async function executeSql<T = unknown>(
  strings: TemplateStringsArray,
  values: unknown[]
): Promise<{ rows: T[] }> {
  // Process template to handle RawSql markers
  const { processedStrings, processedValues } = processSqlTemplate(strings, values);
  
  // Serialize values safely before passing to vercelSql
  const serializedValues = processedValues.map(serializeSqlValue);
  const result = await vercelSql(processedStrings, ...(serializedValues as Parameters<typeof vercelSql>[1][]));
  
  return normalizeDbResult<T>(result);
}

/**
 * Direct SQL execution with automatic database initialization
 * Use this for all database operations
 * Automatically initializes database schema if tables don't exist
 */
async function sqlFunction<T = unknown>(
  strings: TemplateStringsArray, 
  ...values: unknown[]
): Promise<{ rows: T[] }> {
  return trackExecutionTime('db.query', async () => {
    return withRetry(
      async () => {
        return executeSql<T>(strings, values);
      },
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        retryable: (error) => {
          // Don't retry on "relation does not exist" - that's handled separately
          if (isRelationNotExistError(error)) {
            return false;
          }
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Retry on connection errors, timeouts, and temporary failures
          return (
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('temporary')
          );
        },
      }
    );
  }, { operation: 'sql' }).catch(async (error) => {
    // Check if it's a "relation does not exist" error and we haven't tried auto-init yet
    if (isRelationNotExistError(error) && !autoInitAttempted) {
      autoInitAttempted = true;
      logger.logApiInfo('Detected uninitialized database, attempting automatic initialization');
      
      try {
        // Attempt to initialize database
        await initDatabase();
        logger.logApiInfo('Database auto-initialized successfully, retrying query');
        
        // Reset flag after successful initialization to allow future retries if needed
        autoInitAttempted = false;
        
        // Retry the original query
        return executeSql<T>(strings, values);
      } catch (initError) {
        autoInitAttempted = false; // Reset flag on failure
        logger.logApiError('Database auto-initialization failed', initError instanceof Error ? initError : new Error(String(initError)));
        // Fall through to original error
      }
    }
    
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Extract inner error details from error.cause (Drizzle wraps original errors)
    const errorDetails: Record<string, unknown> = {
      errorMessage,
      errorName: error instanceof Error ? error.name : 'Unknown',
    };
    
    if (error instanceof Error && error.cause) {
      const causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
      const causeName = error.cause instanceof Error ? error.cause.name : 'Unknown';
      errorDetails.causeMessage = causeMessage;
      errorDetails.causeName = causeName;
      
      // Check for nested cause
      if (error.cause instanceof Error && error.cause.cause) {
        const nestedCauseMessage = error.cause.cause instanceof Error 
          ? error.cause.cause.message 
          : String(error.cause.cause);
        errorDetails.nestedCauseMessage = nestedCauseMessage;
      }
    }
    
    const isConfigError = 
      errorMessage.includes('POSTGRES_URL') ||
      errorMessage.includes('DATABASE_URL') ||
      errorMessage.includes('configuration missing');
    
    const isConnectionError = 
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('getaddrinfo');
    
    if (isConfigError || isConnectionError) {
      logger.logApiError('SQL execution failed - Database configuration issue', error instanceof Error ? error : new Error(String(error)), {
        ...errorDetails,
        errorType: isConfigError ? 'configuration' : 'connection',
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        help: isConfigError 
          ? 'Add POSTGRES_URL to Vercel Dashboard → Settings → Environment Variables and redeploy'
          : 'Check your database connection string and ensure the database is accessible',
      });
    } else {
      logger.logApiError('SQL execution failed', error instanceof Error ? error : new Error(String(error)), errorDetails);
    }
    
    throw error;
  });
}

/**
 * SQL template tag with raw() helper for dynamic identifiers
 * Use sql`...` for parameterized queries
 * Use sql.raw('table_name') for dynamic table/column names (only with trusted identifiers)
 */
export const sql = Object.assign(sqlFunction, {
  raw,
});

/**
 * Check if database is initialized by checking if users table exists
 * Uses direct vercelSql to avoid recursion with sql() function
 */
async function isDatabaseInitialized(): Promise<boolean> {
  try {
    // Use direct vercelSql to avoid recursion
    const result = await vercelSql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `;
    
    // Handle different result formats
    const normalized = normalizeDbResult<{ exists: boolean }>(result);
    return normalized.rows[0]?.exists === true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = 
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('getaddrinfo');
    
    const hasConfig = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    
    logger.logApiError('Database initialization check failed', error instanceof Error ? error : new Error(String(error)), {
      message: errorMessage,
      postgresUrl: process.env.POSTGRES_URL ? 'configured' : 'missing',
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
      isConnectionError,
      hasConfig,
    });
    
    // Provide helpful error message if connection string is missing
    if (!hasConfig) {
      logger.logApiError('Database connection string missing', new Error('POSTGRES_URL or DATABASE_URL not configured'), {
        help: 'Add POSTGRES_URL to Vercel Dashboard → Settings → Environment Variables',
      });
    }
    
    return false;
  }
}

// Mutex for database initialization to prevent race conditions
let initMutex: Promise<void> | null = null;

/**
 * Validate database connection environment variables
 * Provides helpful error messages for common setup issues
 */
function validateDatabaseConfig(): void {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!postgresUrl && !databaseUrl) {
    const errorMessage = 
      'Database configuration missing: POSTGRES_URL or DATABASE_URL environment variable must be set.\n\n' +
      'To fix this:\n' +
      '1. If using Neon: Create a database at https://neon.tech and copy the Connection String\n' +
      '2. If using Vercel Postgres: Create Postgres Storage in Vercel Dashboard → Storage\n' +
      '3. Add POSTGRES_URL to Vercel Dashboard → Settings → Environment Variables\n' +
      '4. Redeploy your project after adding the variable\n\n' +
      'The connection string should start with: postgresql://';
    
    logger.logApiError('Database configuration missing', new Error(errorMessage), {
      hasPostgresUrl: !!postgresUrl,
      hasDatabaseUrl: !!databaseUrl,
      nodeEnv: process.env.NODE_ENV,
    });
    
    throw new Error(errorMessage);
  }
  
  // Validate connection string format if provided
  const connectionString = postgresUrl || databaseUrl;
  if (connectionString && !connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    logger.logApiError('Invalid database connection string format', new Error('Connection string must start with postgresql:// or postgres://'), {
      connectionStringPrefix: connectionString.substring(0, 20) + '...',
    });
    throw new Error(
      'Invalid database connection string format. Connection string must start with "postgresql://" or "postgres://".\n\n' +
      'Please check your POSTGRES_URL or DATABASE_URL environment variable.'
    );
  }
}

/**
 * Initialize database schema
 * Call this once at application startup
 * Idempotent - safe to call multiple times
 * Thread-safe: multiple concurrent calls will share the same initialization promise
 */
export async function initDatabase(): Promise<void> {
  // Validate configuration before attempting connection
  validateDatabaseConfig();

  // If initialization is in progress, wait for it
  if (initMutex) {
    try {
      await initMutex;
      return;
    } catch (error) {
      // If previous initialization failed, clear mutex and retry
      initMutex = null;
      // Continue to start new initialization
    }
  }

  // Start initialization
  initMutex = (async () => {
    try {
      // Check if already initialized
      const alreadyInitialized = await isDatabaseInitialized();
      
      if (!alreadyInitialized) {
        logger.logApiInfo('Initializing database schema');
      } else {
        logger.logApiInfo('Database already initialized, running migrations');
      }

      // Use direct vercelSql for table creation to avoid recursion
      // Create users table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_id VARCHAR(255) UNIQUE,
        device_id VARCHAR(255) UNIQUE,
        email VARCHAR(255),
        telegram_id VARCHAR(255) UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        photo_url TEXT,
        language_code VARCHAR(10),
        vk_id VARCHAR(255) UNIQUE,
        yandex_id VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT users_identity_check CHECK (clerk_id IS NOT NULL OR device_id IS NOT NULL OR telegram_id IS NOT NULL OR vk_id IS NOT NULL OR yandex_id IS NOT NULL)
      );
    `;

      // ALWAYS run migrations: Add missing columns to existing users table (for schema sync)
      // This ensures schema is up-to-date even if table already exists
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS vk_id VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS yandex_id VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS username VARCHAR(255);
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS photo_url TEXT;
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS language_code VARCHAR(10);
      `;

      // Fix: Ensure telegram_id has a unique constraint (required for ON CONFLICT)
      // First, deduplicate users with the same telegram_id (keep the most recent one)
      try {
        await vercelSql`
          DELETE FROM users
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY telegram_id ORDER BY updated_at DESC) AS rnum
              FROM users
              WHERE telegram_id IS NOT NULL
            ) t
            WHERE t.rnum > 1
          );
        `;
        logger.logApiInfo('Deduplicated users with duplicate telegram_id');
      } catch (error) {
        // Log but don't fail - deduplication is best effort
        logger.logApiError('Failed to deduplicate users by telegram_id', error instanceof Error ? error : new Error(String(error)));
      }

      // ALWAYS create unique indexes/constraints for new identity columns
      // For telegram_id, we need a full UNIQUE constraint (not partial) to support ON CONFLICT
      // PostgreSQL allows multiple NULLs in UNIQUE constraints, which is what we need
      try {
        // Drop partial index if it exists
        await vercelSql`DROP INDEX IF EXISTS idx_users_telegram_id;`;
        
        // Try to create UNIQUE constraint - will fail silently if it already exists
        // This handles both our named constraint and auto-generated constraints from CREATE TABLE
        await vercelSql`
          DO $$
          BEGIN
            -- Check if constraint with our name exists
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'users_telegram_id_unique'
            ) THEN
              -- Try to create constraint - may fail if another unique constraint exists on telegram_id
              BEGIN
                ALTER TABLE users 
                ADD CONSTRAINT users_telegram_id_unique 
                UNIQUE (telegram_id);
              EXCEPTION WHEN duplicate_object THEN
                -- Constraint already exists with different name (e.g., from CREATE TABLE)
                -- This is fine - ON CONFLICT will work with any unique constraint on the column
                NULL;
              END;
            END IF;
          END $$;
        `;
        logger.logApiInfo('Ensured unique constraint on users.telegram_id');
      } catch (error) {
        // Log but don't fail - constraint might already exist or be created by CREATE TABLE
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exists') && !errorMessage.includes('duplicate')) {
          logger.logApiError('Failed to ensure users.telegram_id unique constraint', error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      // Note: UNIQUE constraint automatically creates a unique index with the same name
      // No need to create a separate index - it would conflict with the constraint
      await vercelSql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id) WHERE vk_id IS NOT NULL;
      `;
      await vercelSql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_yandex_id ON users(yandex_id) WHERE yandex_id IS NOT NULL;
      `;

      // ALWAYS update constraint for existing tables to include new identity fields
      // Drop old constraint if it exists and create new one
      await vercelSql`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'users_identity_check'
          ) THEN
            ALTER TABLE users DROP CONSTRAINT users_identity_check;
          END IF;
        END $$;
      `;
      await vercelSql`
        ALTER TABLE users 
        ADD CONSTRAINT users_identity_check 
        CHECK (clerk_id IS NOT NULL OR device_id IS NOT NULL OR telegram_id IS NOT NULL OR vk_id IS NOT NULL OR yandex_id IS NOT NULL);
      `;

      // Create subscriptions table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'pro', 'premium')),
        status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        yookassa_subscription_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

      // ALWAYS create unique index for active subscriptions
      await vercelSql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_subscription ON subscriptions (user_id) WHERE status = 'active';
    `;

      // Create generations table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT,
        prompt_used TEXT,
        trend VARCHAR(50),
        quality VARCHAR(10),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

      // ALWAYS add status column if it doesn't exist (for existing databases)
      await vercelSql`
        ALTER TABLE generations 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
      `;
      await vercelSql`
        ALTER TABLE generations 
        ADD COLUMN IF NOT EXISTS error_message TEXT;
      `;
      await vercelSql`
        ALTER TABLE generations 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      `;
      
      // Update existing records to have 'completed' status if status is NULL
      await vercelSql`
        UPDATE generations 
        SET status = 'completed' 
        WHERE status IS NULL;
      `;
      
      // Add status constraint if it doesn't exist
      await vercelSql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'generations_status_check'
          ) THEN
            ALTER TABLE generations 
            ADD CONSTRAINT generations_status_check 
            CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
          END IF;
        END $$;
      `;
      
      // Create index for status queries
      await vercelSql`
        CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
      `;

      // Create usage_logs table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL CHECK (action IN ('generation', 'download')),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

      // ALWAYS add ip_address column if it doesn't exist (for existing databases)
      await vercelSql`
      ALTER TABLE usage_logs 
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
    `;

      // ALWAYS create indexes for ip_address if they don't exist
      await vercelSql`
      CREATE INDEX IF NOT EXISTS idx_usage_logs_ip_address ON usage_logs(ip_address);
    `;

      await vercelSql`
      CREATE INDEX IF NOT EXISTS idx_usage_logs_rate_limit ON usage_logs(user_id, ip_address, action, created_at);
    `;

      // Create payments table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        yookassa_payment_id VARCHAR(255) UNIQUE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'RUB',
        status VARCHAR(50) NOT NULL,
        token_package VARCHAR(50),
        tokens_amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

      // Create user_tokens table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER DEFAULT 0 NOT NULL,
        last_bonus_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT user_tokens_user_id_unique UNIQUE (user_id)
      );
    `;

      // Ensure user_tokens has unique constraint on user_id (required for ON CONFLICT)
      // This handles cases where table existed before constraint was added
      try {
        await vercelSql`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'user_tokens_user_id_unique'
            ) THEN
              BEGIN
                ALTER TABLE user_tokens 
                ADD CONSTRAINT user_tokens_user_id_unique 
                UNIQUE (user_id);
              EXCEPTION WHEN duplicate_object THEN
                -- Constraint already exists with different name (e.g., from CREATE TABLE)
                -- This is fine - ON CONFLICT will work with any unique constraint on the column
                NULL;
              END;
            END IF;
          END $$;
        `;
        logger.logApiInfo('Ensured unique constraint on user_tokens.user_id');
      } catch (error) {
        // Log but don't fail - constraint might already exist or be created by CREATE TABLE
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exists') && !errorMessage.includes('duplicate')) {
          logger.logApiError('Failed to ensure user_tokens.user_id unique constraint', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Create token_transactions table (only if it doesn't exist)
      await vercelSql`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'bonus', 'generation', 'refund')),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

      // ALWAYS create indexes for performance (idempotent - safe to run multiple times)
      // Split into individual calls to avoid "multiple commands" error
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_payments_yookassa_id ON payments(yookassa_payment_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);`;
      await vercelSql`CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);`;
      
      // Composite index for fast welcome bonus checks (used in trigger and ensureWelcomeBonusAtomic)
      await vercelSql`
        CREATE INDEX IF NOT EXISTS idx_token_transactions_bonus_check 
        ON token_transactions(user_id, type, description) 
        WHERE type = 'bonus';
      `;

      // Unique index to prevent multiple daily bonuses per day (security fix)
      await vercelSql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_bonus_once 
        ON token_transactions (user_id, (created_at::DATE)) 
        WHERE description = 'Daily wheel bonus';
      `;

      if (!alreadyInitialized) {
        logger.logApiInfo('Database schema initialized successfully');
      } else {
        logger.logApiInfo('Database migrations completed successfully');
      }

      // Always update the function to ensure latest security fixes are applied
      // This is critical for fixing vulnerabilities even on existing databases
      // Create database functions and triggers for automatic token initialization
      // This ensures tokens are always created atomically when user is created
      await vercelSql`
        CREATE OR REPLACE FUNCTION initialize_new_user()
        RETURNS TRIGGER AS $$
        DECLARE
          bonus_amount INTEGER;
          bonus_description TEXT;
        BEGIN
          -- 1. Create tokens record automatically
          INSERT INTO user_tokens (user_id, balance)
          VALUES (NEW.id, 0)
          ON CONFLICT (user_id) DO NOTHING;

          -- 2. Determine welcome bonus based on user type
          IF NEW.clerk_id IS NOT NULL THEN
            bonus_amount := 5;
            bonus_description := 'Welcome bonus';
          ELSIF NEW.device_id IS NOT NULL THEN
            -- Security fix: Anonymous users get 0 tokens to prevent abuse
            bonus_amount := 0;
            bonus_description := 'Welcome Pack (anonymous)';
          ELSE
            RETURN NEW; -- Should not happen due to constraint
          END IF;

          -- 3. Give welcome bonus (only if not already given and amount > 0)
          IF bonus_amount > 0 AND NOT EXISTS (
            SELECT 1 FROM token_transactions
            WHERE user_id = NEW.id
              AND type = 'bonus'
              AND description = bonus_description
          ) THEN
            -- Update balance atomically
            UPDATE user_tokens
            SET balance = balance + bonus_amount, updated_at = NOW()
            WHERE user_id = NEW.id;

            -- Add transaction record
            INSERT INTO token_transactions (user_id, amount, type, description)
            VALUES (NEW.id, bonus_amount, 'bonus', bonus_description);
          END IF;

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;

      // ALWAYS ensure trigger exists (idempotent)
      // Create trigger to auto-initialize tokens and welcome bonus
      // Only triggers on INSERT (new users)
      // For existing users (ON CONFLICT DO UPDATE), welcome bonus is handled by ensureWelcomeBonusAtomic
      // Split into separate calls to avoid "multiple commands" error
      await vercelSql`DROP TRIGGER IF EXISTS trigger_initialize_new_user ON users;`;
      
      await vercelSql`
        CREATE TRIGGER trigger_initialize_new_user
          AFTER INSERT ON users
          FOR EACH ROW
          EXECUTE FUNCTION initialize_new_user();
      `;

      logger.logApiInfo('Database functions and triggers updated successfully');
    } catch (error) {
      logger.logApiError('Database initialization failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      // Clear mutex after completion (success or failure) to allow retry if needed
      initMutex = null;
    }
  })();

  await initMutex;
}

