/**
 * POST /api/storage/upload
 * Upload image to storage provider
 * Supports: ?provider=blob (Vercel Blob) or ?provider=r2 (Cloudflare R2)
 * Default: blob if no provider specified
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuth } from '../utils/auth.js';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { setCorsHeaders } from '../utils/cors.js';

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
    const requestBody = request.body as { file?: unknown } | undefined;
    const requestFiles = (request as { files?: { file?: unknown } }).files;
    const file = requestFiles?.file || requestBody?.file;
    if (!file) {
      return response.status(400).json(
        errorResponse('No file provided', 400)
      );
    }

    // Type guard for file with name property
    const hasName = (f: unknown): f is { name?: string; [key: string]: unknown } => {
      return typeof f === 'object' && f !== null;
    };

    // Get provider from query parameter (default: blob)
    const provider = (request.query?.provider as string) || 'blob';
    const filename = (hasName(file) && file.name) ? file.name : 'generation.png';

    let url: string;

    if (provider === 'r2') {
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
      logger.logApiInfo('uploadToBlobStorage', { userId: auth.userId, filename });
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


