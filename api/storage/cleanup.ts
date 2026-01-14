/**
 * POST /api/storage/cleanup - Cleanup old uploads (older than 30 days)
 * This should be called by a cron job
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, list } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import { sql } from '../repositories/database.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'dreamlens';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Only allow POST (or check for a secret token if needed)
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Security: Check for CRON_SECRET or similar if deployed
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Find old uploads in database
    const oldUploads = await sql<{ id: string; url: string; file_path: string | null }>`
      SELECT id, url, file_path 
      FROM user_uploads 
      WHERE created_at < ${thirtyDaysAgo}
    `;

    logger.logApiInfo('storageCleanup', { count: oldUploads.rows.length });

    const results = {
      deletedFromDb: 0,
      deletedFromBlob: 0,
      deletedFromSupabase: 0,
      errors: [] as string[],
    };

    // 2. Delete from Vercel Blob, Supabase, and DB
    for (const upload of oldUploads.rows) {
      try {
        if (upload.url.includes('public.blob.vercel-storage.com')) {
          await del(upload.url, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          results.deletedFromBlob++;
        } else if (supabase && upload.url.includes('supabase.n8nstarter.ru')) {
          const pathPart = upload.url.split(`/public/${SUPABASE_BUCKET_NAME}/`)[1];
          if (pathPart) {
            await supabase.storage.from(SUPABASE_BUCKET_NAME).remove([pathPart]);
            results.deletedFromSupabase++;
          }
        }
        
        await sql`DELETE FROM user_uploads WHERE id = ${upload.id}`;
        results.deletedFromDb++;
      } catch (err) {
        results.errors.push(`Error deleting ${upload.url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Also cleanup old generations if needed (optional)
    // const oldGenerations = await sql`SELECT id, image_url FROM generations WHERE created_at < ${thirtyDaysAgo}`;
    // ... similar logic ...

    return response.status(200).json(
      successResponse({
        message: 'Cleanup completed',
        results,
      })
    );
  } catch (error) {
    logger.logApiError('storageCleanupError', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}
