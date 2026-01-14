/**
 * Generation Service
 * Business logic for generations and usage tracking
 */

import * as GenerationRepo from '../repositories/generation.repository.js';
import { logger } from '../utils/logger.js';
import type { ImageWithQuality } from '../types/images.js';
import { getTrendPrompt } from '../../prompts/trendPrompts.js';
import { sanitizePrompt } from '../../utils/validation.js';
import { getTokenCost, getBatchTokenCost, getBatchDiscount } from '../../shared/constants.js';
import { TrendType } from '../../types.js';
import type { ImageGenerationRequestBody } from '../utils/validation.js';

/**
 * Count user generations today
 */
export async function countGenerationsToday(userId: string): Promise<number> {
  try {
    return await GenerationRepo.countGenerationsToday(userId);
  } catch (error) {
    logger.logApiError('GenerationService - countGenerationsToday', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Prepare and select best images for generation
 * Sorts by quality score and selects top images
 */
export function prepareImages(userImages: ImageGenerationRequestBody['userImages']): ImageWithQuality[] {
  const typedImages: ImageWithQuality[] = userImages.map(img => ({
    base64: img.base64,
    qualityScore: img.qualityScore,
    mimeType: img.mimeType,
  }));
  
  const sortedImages = [...typedImages].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  let selectedImages = sortedImages.filter((img) => (img.qualityScore || 0) > 40).slice(0, 5);
  if (selectedImages.length < 3) {
    selectedImages = sortedImages.slice(0, 3);
  }
  
  return selectedImages;
}

/**
 * Convert images to Gemini API format
 */
export function convertImagesToParts(
  selectedImages: ImageWithQuality[],
  referenceImage?: ImageGenerationRequestBody['config']['referenceImage']
): Array<{ inlineData: { data: string; mimeType: string } }> {
  const imageParts = selectedImages.map((img) => ({
    inlineData: {
      data: img.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
      mimeType: img.mimeType || 'image/jpeg',
    },
  }));

  // Add reference image if exists
  if (referenceImage && referenceImage.base64) {
    imageParts.push({
      inlineData: {
        data: referenceImage.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
        mimeType: referenceImage.mimeType || 'image/jpeg',
      },
    });
  }

  return imageParts;
}

/**
 * Build final prompt for image generation
 */
export function buildGenerationPrompt(
  config: ImageGenerationRequestBody['config'],
  selectedImagesCount: number
): { systemInstruction?: string; mainPrompt: string; finalPrompt: string } {
  const sanitizedUserPrompt = config.userPrompt ? sanitizePrompt(config.userPrompt) : undefined;
  const sanitizedRefinement = config.refinementText ? sanitizePrompt(config.refinementText) : undefined;
  const numberOfPeople = Math.max(1, Math.min(4, config.numberOfPeople ?? (config.trend === TrendType.COUPLE ? 2 : 1)));
  
  // Validate and convert trend string to TrendType
  const trendType = config.trend as TrendType;
  if (!Object.values(TrendType).includes(trendType)) {
    throw new Error('Неверный тип стиля');
  }
  
  const { systemInstruction, mainPrompt } = getTrendPrompt(
    trendType,
    config.dominantColor,
    sanitizedUserPrompt,
    sanitizedRefinement,
    !!config.referenceImage,
    numberOfPeople
  );

  const finalPrompt = `
    ${mainPrompt}
    
    CRITICAL EXECUTION:
    1. OUTPUT: Generate exactly ONE single image. DO NOT create collages, grids, multiple photos, or image compositions. The output must be a single unified photograph.
    2. SUBJECT COUNT: The photo must show exactly ${numberOfPeople} distinct person(s). Do NOT merge faces. No extra people, no missing people.
    3. FACE: Must look exactly like the uploaded subject(s) (first ${selectedImagesCount} images are reference photos - use them to understand each face).
    4. QUALITY: Cinematic, detailed, expensive.
  `;

  return { systemInstruction, mainPrompt, finalPrompt };
}

/**
 * Calculate token cost for quality (single image)
 */
export function calculateTokenCost(quality: string): number {
  return getTokenCost(quality);
}

/**
 * Calculate token cost for batch generation (with progressive discount)
 */
export function calculateBatchTokenCost(quality: string, imageCount: number): number {
  return getBatchTokenCost(quality, imageCount);
}/**
 * Get discount percentage for batch
 */
export function getDiscountForBatch(imageCount: number): number {
  return getBatchDiscount(imageCount);
}