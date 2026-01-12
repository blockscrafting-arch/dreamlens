/**
 * Drizzle Database Connection
 * Provides type-safe database access
 * Automatically runs migrations on schema errors
 */

import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql as vercelSql } from '@vercel/postgres';
import * as schema from './schema.js';
import { initDatabase, isRelationNotExistError } from '../repositories/database.js';
import { logger } from '../utils/logger.js';

// Flag to track if we've attempted auto-initialization to prevent infinite loops
let autoInitAttempted = false;

/**
 * Serialize error with full details including cause, code, and nested properties
 * This helps diagnose schema errors and connection issues
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (!error) {
    return { error: 'null or undefined' };
  }

  const result: Record<string, unknown> = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : typeof error,
  };

  // Extract error code if available
  if (error && typeof error === 'object') {
    if ('code' in error && error.code !== undefined) {
      result.code = error.code;
    }
    if ('errno' in error && error.errno !== undefined) {
      result.errno = error.errno;
    }
    if ('sqlState' in error && error.sqlState !== undefined) {
      result.sqlState = error.sqlState;
    }
  }

  // Extract cause (where Drizzle/Vercel Postgres stores original errors)
  if (error instanceof Error && error.cause) {
    result.cause = serializeError(error.cause);
    
    // Also extract code from cause if available
    if (error.cause && typeof error.cause === 'object') {
      if ('code' in error.cause && error.cause.code !== undefined) {
        result.causeCode = error.cause.code;
      }
    }
  }

  // Extract stack trace if available
  if (error instanceof Error && error.stack) {
    result.stack = error.stack;
  }

  return result;
}

/**
 * Wrap vercelSql client to intercept errors and auto-run migrations
 * This ensures Drizzle queries automatically fix missing columns
 */
function wrapVercelSqlClient(originalClient: typeof vercelSql): typeof vercelSql {
  // Create a wrapper function that handles template literal calls
  const wrappedClient = async function(
    strings: TemplateStringsArray,
    ...values: any[]
  ): Promise<unknown> {
    try {
      return await originalClient(strings, ...values);
    } catch (error) {
      // Serialize error details for logging
      const errorDetails = serializeError(error);
      
      // Check if it's a schema error and we haven't tried auto-init yet
      if (isRelationNotExistError(error) && !autoInitAttempted) {
        autoInitAttempted = true;
        logger.logApiInfo('Detected schema error in Drizzle query, attempting automatic migration', {
          errorDetails,
          isSchemaError: true,
        });
        
        try {
          // Attempt to initialize database (runs migrations)
          await initDatabase();
          logger.logApiInfo('Database migration completed, retrying Drizzle query');
          
          // Reset flag after successful initialization
          autoInitAttempted = false;
          
          // Retry the original query
          return await originalClient(strings, ...values);
        } catch (initError) {
          autoInitAttempted = false; // Reset flag on failure
          const initErrorDetails = serializeError(initError);
          logger.logApiError('Database auto-migration failed in Drizzle wrapper', 
            initError instanceof Error ? initError : new Error(String(initError)), {
              originalError: errorDetails,
              initError: initErrorDetails,
            });
          // Fall through to original error
        }
      } else {
        // Log non-schema errors with full details for debugging
        logger.logApiError('Drizzle query failed', 
          error instanceof Error ? error : new Error(String(error)), {
            errorDetails,
            isSchemaError: isRelationNotExistError(error),
            autoInitAttempted,
          });
      }
      
      // Re-throw original error if not handled
      throw error;
    }
  } as typeof vercelSql;
  
  // Copy all properties from original client to maintain compatibility
  Object.setPrototypeOf(wrappedClient, Object.getPrototypeOf(originalClient));
  Object.assign(wrappedClient, originalClient);
  
  return wrappedClient;
}

// Wrap the vercelSql client to auto-handle schema errors
const wrappedSql = wrapVercelSqlClient(vercelSql);

// Create Drizzle instance with wrapped client
export const db = drizzle(wrappedSql, { schema });

// Export schema for use in repositories
export { schema };

