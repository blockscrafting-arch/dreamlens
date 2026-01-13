/**
 * Unit tests for shared constants (pricing, batch multipliers)
 */

import { describe, it, expect } from 'vitest';
import {
  getBatchTokenCost,
  getBatchDiscount,
  BATCH_MULTIPLIERS,
  TOKEN_COSTS,
  ImageQuality,
} from '../../shared/constants';

describe('Batch Token Cost Calculation', () => {
  it('should calculate correct cost for single image (1K)', () => {
    expect(getBatchTokenCost(ImageQuality.STD, 1)).toBe(1);
  });

  it('should calculate correct cost for single image (2K)', () => {
    expect(getBatchTokenCost(ImageQuality.HD, 1)).toBe(2);
  });

  it('should calculate correct cost for single image (4K)', () => {
    expect(getBatchTokenCost(ImageQuality.UHD, 1)).toBe(3);
  });

  it('should apply correct multiplier for 2 images', () => {
    const cost1K = getBatchTokenCost(ImageQuality.STD, 2);
    const cost2K = getBatchTokenCost(ImageQuality.HD, 2);
    const cost4K = getBatchTokenCost(ImageQuality.UHD, 2);

    // 2 images: 1.9x multiplier
    expect(cost1K).toBe(Math.ceil(1 * 1.9)); // 2
    expect(cost2K).toBe(Math.ceil(2 * 1.9)); // 4
    expect(cost4K).toBe(Math.ceil(3 * 1.9)); // 6
  });

  it('should apply correct multiplier for 3 images', () => {
    const cost1K = getBatchTokenCost(ImageQuality.STD, 3);
    const cost2K = getBatchTokenCost(ImageQuality.HD, 3);
    const cost4K = getBatchTokenCost(ImageQuality.UHD, 3);

    // 3 images: 2.7x multiplier
    expect(cost1K).toBe(Math.ceil(1 * 2.7)); // 3
    expect(cost2K).toBe(Math.ceil(2 * 2.7)); // 6
    expect(cost4K).toBe(Math.ceil(3 * 2.7)); // 9
  });

  it('should apply correct multiplier for 4 images', () => {
    const cost1K = getBatchTokenCost(ImageQuality.STD, 4);
    const cost2K = getBatchTokenCost(ImageQuality.HD, 4);
    const cost4K = getBatchTokenCost(ImageQuality.UHD, 4);

    // 4 images: 3.4x multiplier
    expect(cost1K).toBe(Math.ceil(1 * 3.4)); // 4
    expect(cost2K).toBe(Math.ceil(2 * 3.4)); // 7
    expect(cost4K).toBe(Math.ceil(3 * 3.4)); // 11
  });

  it('should apply correct multiplier for 5 images', () => {
    const cost1K = getBatchTokenCost(ImageQuality.STD, 5);
    const cost2K = getBatchTokenCost(ImageQuality.HD, 5);
    const cost4K = getBatchTokenCost(ImageQuality.UHD, 5);

    // 5 images: 4.0x multiplier
    expect(cost1K).toBe(Math.ceil(1 * 4.0)); // 4
    expect(cost2K).toBe(Math.ceil(2 * 4.0)); // 8
    expect(cost4K).toBe(Math.ceil(3 * 4.0)); // 12
  });

  it('should clamp to minimum batch size (1)', () => {
    expect(getBatchTokenCost(ImageQuality.STD, 0)).toBe(1);
    expect(getBatchTokenCost(ImageQuality.STD, -1)).toBe(1);
  });

  it('should clamp to maximum batch size (5)', () => {
    expect(getBatchTokenCost(ImageQuality.STD, 10)).toBe(Math.ceil(1 * 4.0));
    expect(getBatchTokenCost(ImageQuality.STD, 100)).toBe(Math.ceil(1 * 4.0));
  });
});

describe('Batch Discount Calculation', () => {
  it('should return 0% discount for 1 image', () => {
    expect(getBatchDiscount(1)).toBe(0);
  });

  it('should calculate correct discount for 2 images', () => {
    // 2 images: 1.9x vs 2.0x = 5% discount
    const discount = getBatchDiscount(2);
    expect(discount).toBe(5);
  });

  it('should calculate correct discount for 3 images', () => {
    // 3 images: 2.7x vs 3.0x = 10% discount
    const discount = getBatchDiscount(3);
    expect(discount).toBe(10);
  });

  it('should calculate correct discount for 4 images', () => {
    // 4 images: 3.4x vs 4.0x = 15% discount
    const discount = getBatchDiscount(4);
    expect(discount).toBe(15);
  });

  it('should calculate correct discount for 5 images', () => {
    // 5 images: 4.0x vs 5.0x = 20% discount
    const discount = getBatchDiscount(5);
    expect(discount).toBe(20);
  });
});

describe('Batch Multipliers', () => {
  it('should have correct multiplier values', () => {
    expect(BATCH_MULTIPLIERS[1]).toBe(1.0);
    expect(BATCH_MULTIPLIERS[2]).toBe(1.9);
    expect(BATCH_MULTIPLIERS[3]).toBe(2.7);
    expect(BATCH_MULTIPLIERS[4]).toBe(3.4);
    expect(BATCH_MULTIPLIERS[5]).toBe(4.0);
  });

  it('should have progressive discount structure', () => {
    // Each step should provide better value
    const cost1 = BATCH_MULTIPLIERS[1];
    const cost2 = BATCH_MULTIPLIERS[2];
    const cost3 = BATCH_MULTIPLIERS[3];
    const cost4 = BATCH_MULTIPLIERS[4];
    const cost5 = BATCH_MULTIPLIERS[5];

    // Verify progressive structure
    expect(cost2 / 2).toBeLessThan(cost1); // Per image cheaper
    expect(cost3 / 3).toBeLessThan(cost2 / 2);
    expect(cost4 / 4).toBeLessThan(cost3 / 3);
    expect(cost5 / 5).toBeLessThan(cost4 / 4);
  });
});

describe('Token Costs', () => {
  it('should have correct base costs', () => {
    expect(TOKEN_COSTS[ImageQuality.STD]).toBe(1);
    expect(TOKEN_COSTS[ImageQuality.HD]).toBe(2);
    expect(TOKEN_COSTS[ImageQuality.UHD]).toBe(3);
  });
});
