/**
 * DELETE /api/storage/delete - Delete image from storage
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del } from '@vercel/blob';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../utils/auth.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { setCorsHeaders } from '../utils/cors.js';
import { sql } from '../repositories/database.js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'dreamlens';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const s3Client = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'DELETE') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse());
    }

    const { url } = request.body as { url?: string };
    if (!url) {
      return response.status(400).json(
        errorResponse('No URL provided', 400)
      );
    }

    // 1. Get info from DB to verify ownership and get file_path
    const uploadResult = await sql<{ id: string; file_path: string | null }>`
      SELECT id, file_path FROM user_uploads 
      WHERE url = ${url} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (uploadResult.rows.length === 0) {
      // Might be a generation, not a user upload, or someone else's file
      // Check generations table too?
      const genResult = await sql<{ id: string; image_url: string }>`
        SELECT id, image_url FROM generations 
        WHERE image_url = ${url} AND user_id = ${auth.userId}
        LIMIT 1
      `;
      
      if (genResult.rows.length === 0) {
        return response.status(403).json(
          errorResponse('File not found or access denied', 403)
        );
      }
    }

    const filePath = uploadResult.rows[0]?.file_path || url;

    // 2. Delete from storage
    if (url.includes('public.blob.vercel-storage.com')) {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } else if (supabase && url.includes('supabase.n8nstarter.ru')) {
      // Extract path from Supabase URL
      // URL format: https://supabase.n8nstarter.ru/storage/v1/object/public/dreamlens/uploads/user_id/filename.png
      const pathPart = url.split(`/public/${SUPABASE_BUCKET_NAME}/`)[1];
      if (pathPart) {
        await supabase.storage.from(SUPABASE_BUCKET_NAME).remove([pathPart]);
      }
    } else if (s3Client && R2_BUCKET_NAME && url.includes('r2.cloudflarestorage.com')) {
      const key = filePath.replace(/.*r2\.cloudflarestorage\.com\/[^\/]+\//, '');
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
    }

    // 3. Delete from database
    await sql`DELETE FROM user_uploads WHERE url = ${url} AND user_id = ${auth.userId}`;

    return response.status(200).json(
      successResponse({
        success: true,
      })
    );
  } catch (error) {
    logger.logApiError('deleteFromStorage', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}
