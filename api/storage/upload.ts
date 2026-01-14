/**
 * POST /api/storage/upload
 * Upload image to storage provider
 * Supports: ?provider=blob (Vercel Blob) or ?provider=r2 (Cloudflare R2)
 * Default: blob if no provider specified
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../utils/auth.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { setCorsHeaders } from '../utils/cors.js';
import { sql } from '../repositories/database.js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, ''); // Remove trailing slash
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'dreamlens';

// Debug logging for Railway
console.log('[DEBUG-SUPABASE] Config check:', {
  hasUrl: !!SUPABASE_URL,
  url: SUPABASE_URL,
  keyLength: SUPABASE_SERVICE_ROLE_KEY?.length,
  keyPrefix: SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10),
  bucket: SUPABASE_BUCKET_NAME
});

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

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

// Upload to Vercel Blob Storage
interface BlobUploadFile {
  data?: Buffer | string;
  [key: string]: unknown;
}

async function uploadToBlob(
  file: BlobUploadFile | Buffer | string,
  filename: string
): Promise<string> {
  const fileData = (typeof file === 'object' && file !== null && 'data' in file) 
    ? file.data || file 
    : file;
  const blob = await put(filename, fileData as Buffer | string, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

// Upload to Cloudflare R2
interface UploadFile {
  data: Buffer | string;
  type?: string;
  size?: number;
}

async function uploadToR2(
  file: UploadFile,
  filename: string,
  userId: string
): Promise<string> {
  if (!s3Client || !R2_BUCKET_NAME) {
    throw new Error('R2 storage not configured');
  }

  // Generate unique filename
  const r2Filename = `generations/${userId}/${Date.now()}-${filename}`;

  // Upload to R2
  const fileBody = file.data || (file as unknown as Buffer | string);
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Filename,
    Body: fileBody,
    ContentType: file.type || 'image/png',
  });

  await s3Client.send(command);

  // Return public URL
  const publicUrl = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${r2Filename}`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Filename}`;
  
  return publicUrl;
}

// Upload to Supabase Storage
async function uploadToSupabase(
  file: Buffer | string,
  filename: string,
  userId: string,
  mimeType?: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase storage not configured');
  }

  const filePath = `uploads/${userId}/${Date.now()}-${filename}`;
  const fileBody = typeof file === 'string' ? Buffer.from(file.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64') : file;

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET_NAME)
    .upload(filePath, fileBody, {
      contentType: mimeType || 'image/png',
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(SUPABASE_BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrl;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
  setCorsHeaders(response, requestOrigin);

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse());
    }

    // Get file from form data
    // Note: VercelRequest doesn't have files/body typed, so we need to access them safely
    const requestBody = request.body as { file?: unknown; qualityScore?: string | number; mimeType?: string } | undefined;
    const requestFiles = (request as { files?: { file?: unknown } }).files;
    const multerFile = (request as any).file;
    
    // Support both Vercel (files/body) and Express/Multer (file)
    let file = multerFile || requestFiles?.file || requestBody?.file;
    
    if (!file) {
      return response.status(400).json(
        errorResponse('No file provided', 400)
      );
    }

    // If it's a multer file, normalize it to match the expected structure
    if (multerFile && !('data' in file) && multerFile.buffer) {
      file = {
        data: multerFile.buffer,
        name: multerFile.originalname,
        type: multerFile.mimetype,
        size: multerFile.size
      };
    }

    const qualityScore = requestBody?.qualityScore ? parseInt(String(requestBody.qualityScore), 10) : null;
    const mimeType = requestBody?.mimeType || null;

    // Type guard for file with name property
    const hasName = (f: unknown): f is { name?: string; [key: string]: unknown } => {
      return typeof f === 'object' && f !== null;
    };

    // Get provider from query parameter (default: blob)
    const provider = (request.query?.provider as string) || 'blob';
    const filename = (hasName(file) && file.name) ? file.name : 'generation.png';

    let url: string;
    let filePath: string | null = null;

    if (provider === 'supabase') {
      // Upload to Supabase
      if (!supabase) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/e7a5ad27-a173-4a22-9e90-9b81c3161ee4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/storage/upload.ts:182',message:'Supabase client not initialized',data:{hasUrl:!!SUPABASE_URL,hasKey:!!SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        return response.status(500).json(
          errorResponse('Supabase storage not configured', 500)
        );
      }
      
      const fileData = (typeof file === 'object' && file !== null && 'data' in file) 
        ? (file as any).data 
        : file;
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/e7a5ad27-a173-4a22-9e90-9b81c3161ee4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/storage/upload.ts:192',message:'Starting Supabase upload',data:{filename,userId:auth.userId,keyLength:SUPABASE_SERVICE_ROLE_KEY?.length,keyStart:SUPABASE_SERVICE_ROLE_KEY?.substring(0,5),serverTime:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
        
      url = await uploadToSupabase(fileData, filename, auth.userId, mimeType || undefined);
      filePath = url; // In Supabase case, URL is fine to store
      logger.logApiInfo('uploadToSupabase', { userId: auth.userId, filename });
    } else if (provider === 'r2') {
      // Upload to Cloudflare R2
      if (!s3Client || !R2_BUCKET_NAME) {
        return response.status(500).json(
          errorResponse('R2 storage not configured', 500)
        );
      }
      // Type guard for R2 upload file
      const isR2File = (f: unknown): f is UploadFile => {
        return typeof f === 'object' && f !== null && 'data' in f;
      };
      if (!isR2File(file)) {
        return response.status(400).json(
          errorResponse('Invalid file format for R2 upload', 400)
        );
      }
      filePath = `generations/${auth.userId}/${Date.now()}-${filename}`;
      url = await uploadToR2(file, filename, auth.userId);
      logger.logApiInfo('uploadToR2', { userId: auth.userId, filename });
    } else {
      // Upload to Vercel Blob (default)
      // Type guard for Blob upload file
      const isBlobFile = (f: unknown): f is BlobUploadFile | Buffer | string => {
        return (
          typeof f === 'string' ||
          Buffer.isBuffer(f) ||
          (typeof f === 'object' && f !== null)
        );
      };
      if (!isBlobFile(file)) {
        return response.status(400).json(
          errorResponse('Invalid file format for Blob upload', 400)
        );
      }
      url = await uploadToBlob(file, filename);
      // For Vercel Blob, the URL itself is the identifier, but we can store it in filePath if needed
      filePath = url;
      logger.logApiInfo('uploadToBlobStorage', { userId: auth.userId, filename });
    }

    // Save to database
    try {
      await sql`
        INSERT INTO user_uploads (user_id, url, file_path, quality_score, mime_type)
        VALUES (${auth.userId}, ${url}, ${filePath}, ${qualityScore}, ${mimeType})
      `;
    } catch (dbError) {
      // Don't fail the upload if DB save fails, but log it
      logger.logApiError('saveUploadToDb', dbError instanceof Error ? dbError : new Error(String(dbError)), {
        userId: auth.userId,
        url
      });
    }

    return response.status(200).json(
      successResponse({
        url,
      })
    );
  } catch (error) {
    logger.logApiError('uploadToStorage', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500)
    );
  }
}


