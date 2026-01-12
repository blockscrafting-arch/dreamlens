/**
 * Input validation utilities
 * Provides type-safe validation for API request bodies
 */

import type { VercelRequest } from '@vercel/node';

/**
 * Maximum payload size in bytes (10MB)
 * Protects against DoS attacks
 */
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Maximum string length for user input fields
 * Protects against DoS attacks via extremely long strings
 */
const MAX_STRING_LENGTH = 10000; // 10KB per string field

/**
 * Maximum allowed base64 length per image (safety guard; overall payload already limited)
 */
const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // 10MB

/**
 * Check request payload size
 * Throws error if payload is too large
 */
export function validatePayloadSize(request: VercelRequest): void {
  const contentLength = request.headers['content-length'];
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    // Check for NaN or invalid values
    if (isNaN(size) || size < 0) {
      throw new Error(`Invalid content-length header: ${contentLength}`);
    }
    if (size > MAX_PAYLOAD_SIZE) {
      throw new Error(`Payload too large: ${size} bytes (max: ${MAX_PAYLOAD_SIZE} bytes)`);
    }
  }
}

/**
 * Type-safe request body extraction
 */
export function getRequestBody<T = unknown>(request: VercelRequest): T {
  return request.body as T;
}

/**
 * Validate that request body exists and is an object
 */
export function validateRequestBody(request: VercelRequest): void {
  if (!request.body || typeof request.body !== 'object') {
    throw new Error('Request body is required and must be an object');
  }
}

/**
 * Image generation request body type
 */
export interface ImageGenerationRequestBody {
  userImages: Array<{
    base64: string;
    qualityScore?: number;
    mimeType?: string;
  }>;
  config: {
    quality: '1K' | '2K' | '4K';
    ratio: 'PORTRAIT' | 'LANDSCAPE' | 'SQUARE';
    trend: string;
    userPrompt?: string;
    refinementText?: string;
    referenceImage?: {
      base64: string;
      mimeType?: string;
    };
    dominantColor?: string;
  };
}

/**
 * Validate image generation request body
 */
export function validateImageGenerationRequest(body: unknown): body is ImageGenerationRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const b = body as Record<string, unknown>;

  // Validate userImages
  if (!Array.isArray(b.userImages) || b.userImages.length < 3) {
    return false;
  }

  // Validate each image has base64 data and optional fields are typed
  for (const img of b.userImages) {
    if (!img || typeof img !== 'object') {
      return false;
    }
    const image = img as Record<string, unknown>;
    const base64 = image.base64;
    if (typeof base64 !== 'string' || base64.trim() === '') {
      return false;
    }
    if (base64.length > MAX_BASE64_LENGTH) {
      return false;
    }
    if (image.qualityScore !== undefined && typeof image.qualityScore !== 'number') {
      return false;
    }
    if (image.mimeType !== undefined && typeof image.mimeType !== 'string') {
      return false;
    }
  }

  // Validate config
  if (!b.config || typeof b.config !== 'object') {
    return false;
  }

  const config = b.config as Record<string, unknown>;

  // Validate quality
  if (config.quality && !['1K', '2K', '4K'].includes(config.quality as string)) {
    return false;
  }

  // Validate ratio - accept both enum values ('3:4', '1:1', etc.) and legacy names ('PORTRAIT', 'LANDSCAPE', 'SQUARE')
  const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9', 'PORTRAIT', 'LANDSCAPE', 'SQUARE'];
  if (config.ratio && !validRatios.includes(config.ratio as string)) {
    return false;
  }

  // Validate trend
  if (!config.trend || typeof config.trend !== 'string') {
    return false;
  }
  
  // Validate trend length (prevent DoS via extremely long strings)
  if (config.trend.length > MAX_STRING_LENGTH || config.trend.trim() === '') {
    return false;
  }

  // Validate userPrompt length if provided
  if (config.userPrompt && typeof config.userPrompt === 'string' && config.userPrompt.length > MAX_STRING_LENGTH) {
    return false;
  }

  // Validate refinementText length if provided
  if (config.refinementText && typeof config.refinementText === 'string' && config.refinementText.length > MAX_STRING_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Generation creation request body type
 */
export interface CreateGenerationRequestBody {
  imageUrl: string;
  promptUsed?: string;
  trend?: string;
  quality?: string;
}

/**
 * Validate generation creation request body
 */
export function validateCreateGenerationRequest(body: unknown): body is CreateGenerationRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const b = body as Record<string, unknown>;

  // imageUrl is required
  if (!b.imageUrl || typeof b.imageUrl !== 'string') {
    return false;
  }

  return true;
}

/**
 * Payment creation request body type
 */
export interface CreatePaymentRequestBody {
  package: 'small' | 'medium' | 'large';
  returnUrl?: string;
}

/**
 * Validate payment creation request body
 */
export function validateCreatePaymentRequest(body: unknown): body is CreatePaymentRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const b = body as Record<string, unknown>;

  // package is required and must be one of the valid values
  if (!b.package || !['small', 'medium', 'large'].includes(b.package as string)) {
    return false;
  }

  return true;
}

