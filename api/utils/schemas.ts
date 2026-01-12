/**
 * Zod schemas for request validation
 * Type-safe validation with automatic TypeScript inference
 */

import { z } from 'zod';

/**
 * Image with quality metadata
 */
export const ImageWithQualitySchema = z.object({
  base64: z.string().min(1, 'Base64 image data is required'),
  qualityScore: z.number().min(0).max(1).optional(),
  mimeType: z.string().optional(),
});

/**
 * Image generation request body schema
 */
export const ImageGenerationRequestSchema = z.object({
  userImages: z
    .array(ImageWithQualitySchema)
    .min(3, 'At least 3 images are required')
    .max(10, 'Maximum 10 images allowed'),
  config: z.object({
    quality: z.enum(['1K', '2K', '4K']),
    ratio: z.enum(['PORTRAIT', 'LANDSCAPE', 'SQUARE']),
    trend: z.string().min(1, 'Trend is required'),
    userPrompt: z.string().optional(),
    refinementText: z.string().optional(),
    referenceImage: z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().optional(),
      })
      .optional(),
    dominantColor: z.string().optional(),
  }),
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;

/**
 * Generation creation request schema
 */
export const CreateGenerationRequestSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  promptUsed: z.string().optional(),
  trend: z.string().optional(),
  quality: z.string().optional(),
});

export type CreateGenerationRequest = z.infer<typeof CreateGenerationRequestSchema>;

/**
 * Payment creation request schema
 */
export const CreatePaymentRequestSchema = z.object({
  package: z.enum(['small', 'medium', 'large']),
  returnUrl: z.string().url('Invalid return URL').optional(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

/**
 * YooKassa webhook payload schema
 */
export const YooKassaWebhookSchema = z.object({
  type: z.string(),
  event: z.string(),
  object: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.object({
      value: z.string(),
      currency: z.string(),
    }),
    metadata: z
      .object({
        userId: z.string().optional(),
      })
      .optional(),
  }),
});

export type YooKassaWebhook = z.infer<typeof YooKassaWebhookSchema>;

