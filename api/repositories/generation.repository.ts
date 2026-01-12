/**
 * Generation Repository
 * Data access layer for generations and usage logs - only SQL queries, no business logic
 */

import { sql } from './database.js';

export interface Generation {
  id: string;
  user_id: string;
  image_url: string;
  prompt_used: string | null;
  trend: string | null;
  quality: string | null;
  created_at: Date;
}

/**
 * Count user generations today
 */
export async function countGenerationsToday(userId: string): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT COUNT(*) as count
    FROM usage_logs
    WHERE user_id = ${userId}
      AND action = 'generation'
      AND created_at >= CURRENT_DATE
  `;

  return parseInt(result.rows[0]?.count || '0', 10);
}

