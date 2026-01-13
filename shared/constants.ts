/**
 * Shared constants for the whole application
 */

export enum ImageQuality {
  STD = '1K',
  HD = '2K',
  UHD = '4K'
}

/**
 * Token costs for different qualities
 */
export const TOKEN_COSTS: Record<string, number> = {
  [ImageQuality.STD]: 1,
  [ImageQuality.HD]: 2,
  [ImageQuality.UHD]: 3,
};

/**
 * Default token cost if quality is unknown
 */
export const DEFAULT_TOKEN_COST = 1;

/**
 * Get token cost for a given quality
 */
export function getTokenCost(quality: string | undefined | null): number {
  if (!quality) return TOKEN_COSTS[ImageQuality.STD];
  
  // Normalize quality string
  const normalized = quality.toUpperCase();
  if (normalized === 'STD' || normalized === '1K') return TOKEN_COSTS[ImageQuality.STD];
  if (normalized === 'HD' || normalized === '2K') return TOKEN_COSTS[ImageQuality.HD];
  if (normalized === 'UHD' || normalized === '4K') return TOKEN_COSTS[ImageQuality.UHD];
  
  return TOKEN_COSTS[normalized] || DEFAULT_TOKEN_COST;
}

/**
 * Batch multipliers for generating multiple images
 * Progressive discount: the more images, the cheaper per image
 * 1 image = 1.0x (base price)
 * 2 images = 1.8x (10% discount)
 * 3 images = 2.4x (20% discount)
 * 4 images = 2.8x (30% discount)
 * 5 images = 3.0x (40% discount)
 */
export const BATCH_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.8,
  3: 2.4,
  4: 2.8,
  5: 3.0,
};

/**
 * Maximum number of images that can be generated in a batch
 */
export const MAX_BATCH_SIZE = 5;

/**
 * Minimum number of images that can be generated
 */
export const MIN_BATCH_SIZE = 1;

/**
 * Get token cost for generating multiple images at a given quality
 * Applies progressive discount based on batch size
 */
export function getBatchTokenCost(quality: string | undefined | null, count: number): number {
  const baseCost = getTokenCost(quality);
  const safeCount = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, count));
  const multiplier = BATCH_MULTIPLIERS[safeCount] || safeCount;
  return Math.ceil(baseCost * multiplier);
}

/**
 * Get discount percentage for a given batch size
 */
export function getBatchDiscount(count: number): number {
  if (count <= 1) return 0;
  const fullPrice = count; // Without discount: count * 1.0
  const discountedPrice = BATCH_MULTIPLIERS[count] || count;
  return Math.round((1 - discountedPrice / fullPrice) * 100);
}

/**
 * Authentication header prefixes
 */
export const AUTH_HEADER_PREFIXES = {
  DEVICE: 'Device ',
  BEARER: 'Bearer ',
  TELEGRAM: 'Telegram ',
} as const;
