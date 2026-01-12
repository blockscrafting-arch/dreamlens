/**
 * Drizzle Kit Configuration
 * Used for generating migrations
 */

import type { Config } from 'drizzle-kit';

export default {
  schema: './api/db/schema.ts',
  out: './database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
  },
} satisfies Config;

