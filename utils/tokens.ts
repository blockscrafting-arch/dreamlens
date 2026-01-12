/**
 * Shared token utility functions
 */

export const TOKEN_COSTS = {
  '1K': 1,
  '2K': 2,
  '4K': 3,
} as const;

/**
 * Calculate token cost based on image quality
 */
export function calculateTokenCost(quality: string | undefined | null): number {
  if (!quality) return TOKEN_COSTS['1K'];
  return TOKEN_COSTS[quality as keyof typeof TOKEN_COSTS] || TOKEN_COSTS['1K'];
}
