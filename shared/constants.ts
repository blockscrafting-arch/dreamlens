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
 * Authentication header prefixes
 */
export const AUTH_HEADER_PREFIXES = {
  DEVICE: 'Device ',
  BEARER: 'Bearer ',
  TELEGRAM: 'Telegram ',
} as const;
