/**
 * Batch operations utilities
 * Optimizes database operations by batching multiple queries
 */

import { sql as vercelSql } from '@vercel/postgres';
import { logger } from './logger.js';

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
 * Validate table/column name to prevent SQL injection
 */
function validateIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Execute multiple operations in a single batch
 * Useful for inserting/updating multiple records at once
 * Note: Executes inserts sequentially for safety and type safety
 */
export async function batchInsert<T>(
  table: string,
  records: Array<Record<string, unknown>>,
  returning: string = '*'
): Promise<T[]> {
  if (records.length === 0) {
    return [];
  }

  // Validate table name
  if (!validateIdentifier(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  // Get column names from first record
  const columns = Object.keys(records[0]);
  if (columns.length === 0) {
    throw new Error('Records must have at least one column');
  }

  // Validate column names
  for (const col of columns) {
    if (!validateIdentifier(col)) {
      throw new Error(`Invalid column name: ${col}`);
    }
  }

  // Execute inserts sequentially using vercelSql directly
  const results: T[] = [];
  
  for (const record of records) {
    const values = columns.map(col => record[col]);
    
    // Build query parts
    const columnList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    try {
      // Use vercelSql directly with template literal
      // Construct the query safely with validated identifiers
      const query = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) RETURNING ${returning}`;
      const result = normalizeDbResult<T>(await vercelSql(query as any, ...(values as Parameters<typeof vercelSql>[1][])));
      if (result.rows && result.rows.length > 0) {
        results.push(...result.rows);
      }
    } catch (error) {
      logger.logApiError(`Batch insert failed for table ${table}`, error instanceof Error ? error : new Error(String(error)), {
        table,
        recordCount: records.length,
      });
      throw error;
    }
  }
  
  return results;
}

/**
 * Batch update records
 * Updates multiple records based on a condition
 * Note: Executes updates sequentially for safety
 */
export async function batchUpdate<T>(
  table: string,
  updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  returning: string = '*'
): Promise<T[]> {
  if (updates.length === 0) {
    return [];
  }

  // Validate table name
  if (!validateIdentifier(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  // Execute updates sequentially
  const results: T[] = [];

  for (const update of updates) {
    const dataKeys = Object.keys(update.data);
    const whereKeys = Object.keys(update.where);
    
    // Validate column names
    for (const key of [...dataKeys, ...whereKeys]) {
      if (!validateIdentifier(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }
    }
    
    const setClause = dataKeys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const whereClause = whereKeys
      .map((key, index) => `${key} = $${dataKeys.length + index + 1}`)
      .join(' AND ');

    const values = [...Object.values(update.data), ...Object.values(update.where)];
    const queryText = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING ${returning}`;

    try {
      const result = normalizeDbResult<T>(await vercelSql(queryText as any, ...(values as Parameters<typeof vercelSql>[1][])));
      if (result.rows && result.rows.length > 0) {
        results.push(...result.rows);
      }
    } catch (error) {
      logger.logApiError(`Batch update failed for table ${table}`, error instanceof Error ? error : new Error(String(error)), {
        table,
        update,
      });
      throw error;
    }
  }

  return results;
}

/**
 * Execute multiple queries in parallel
 * Useful for independent queries that can run concurrently
 */
export async function batchQuery<T>(
  queries: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(queries.map(query => query()));
}
