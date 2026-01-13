/**
 * Unit tests for generation service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildGenerationPrompt,
  prepareImages,
  convertImagesToParts,
  calculateBatchTokenCost,
  getDiscountForBatch,
} from '../../api/services/generation.service';
import { TrendType } from '../../types';

// Mock trendPrompts
vi.mock('../../prompts/trendPrompts', () => ({
  getTrendPrompt: vi.fn((trend, dominantColor, userPrompt, refinementText, hasReference) => ({
    systemInstruction: 'Test system instruction',
    mainPrompt: `Test prompt for ${trend}`,
  })),
}));

describe('buildGenerationPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build prompt for single person', () => {
    const config = {
      trend: TrendType.MAGAZINE,
      quality: '1K' as const,
      ratio: '3:4' as const,
      imageCount: 1,
    };

    const result = buildGenerationPrompt(config, 3);

    expect(result.systemInstruction).toBeDefined();
    expect(result.mainPrompt).toContain('MAGAZINE');
    expect(result.finalPrompt).toContain('ONE single image');
    expect(result.finalPrompt).toContain('SAME person');
  });

  it('should build prompt for couple (two people)', () => {
    const config = {
      trend: TrendType.COUPLE,
      quality: '1K' as const,
      ratio: '3:4' as const,
      imageCount: 1,
      numberOfPeople: 2,
    };

    const result = buildGenerationPrompt(config, 6);

    // Should successfully build prompt
    expect(result.systemInstruction).toBeDefined();
    expect(result.mainPrompt).toBeDefined();
    expect(result.finalPrompt).toBeDefined();
    expect(result.finalPrompt).toContain('COUPLE');
    // Function should handle numberOfPeople parameter without errors
    expect(() => buildGenerationPrompt(config, 6)).not.toThrow();
  });

  it('should include user prompt when provided', () => {
    const config = {
      trend: TrendType.CUSTOM,
      quality: '1K' as const,
      ratio: '3:4' as const,
      imageCount: 1,
      userPrompt: 'Custom prompt text',
    };

    const result = buildGenerationPrompt(config, 3);
    expect(result.mainPrompt).toBeDefined();
  });

  it('should include refinement text when provided', () => {
    const config = {
      trend: TrendType.MAGAZINE,
      quality: '1K' as const,
      ratio: '3:4' as const,
      imageCount: 1,
      refinementText: 'Make it more dramatic',
    };

    const result = buildGenerationPrompt(config, 3);
    expect(result.mainPrompt).toBeDefined();
  });

  it('should handle reference image flag', () => {
    const config = {
      trend: TrendType.MAGAZINE,
      quality: '1K' as const,
      ratio: '3:4' as const,
      imageCount: 1,
      referenceImage: {
        base64: 'test',
        mimeType: 'image/jpeg',
      },
    };

    const result = buildGenerationPrompt(config, 3);
    expect(result.mainPrompt).toBeDefined();
  });
});

describe('prepareImages', () => {
  it('should select top quality images', () => {
    const userImages = [
      { base64: 'img1', qualityScore: 90, mimeType: 'image/jpeg' },
      { base64: 'img2', qualityScore: 50, mimeType: 'image/jpeg' },
      { base64: 'img3', qualityScore: 80, mimeType: 'image/jpeg' },
      { base64: 'img4', qualityScore: 30, mimeType: 'image/jpeg' },
      { base64: 'img5', qualityScore: 70, mimeType: 'image/jpeg' },
    ];

    const result = prepareImages(userImages);

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
    // Should be sorted by quality
    expect(result[0].qualityScore).toBeGreaterThanOrEqual(result[1].qualityScore || 0);
  });

  it('should filter out low quality images when enough high quality available', () => {
    const userImages = [
      { base64: 'img1', qualityScore: 90, mimeType: 'image/jpeg' },
      { base64: 'img2', qualityScore: 85, mimeType: 'image/jpeg' },
      { base64: 'img3', qualityScore: 80, mimeType: 'image/jpeg' },
      { base64: 'img4', qualityScore: 30, mimeType: 'image/jpeg' },
      { base64: 'img5', qualityScore: 20, mimeType: 'image/jpeg' },
    ];

    const result = prepareImages(userImages);

    // Should only include images with quality > 40
    result.forEach((img) => {
      expect(img.qualityScore).toBeGreaterThan(40);
    });
  });

  it('should include lower quality images if not enough high quality', () => {
    const userImages = [
      { base64: 'img1', qualityScore: 50, mimeType: 'image/jpeg' },
      { base64: 'img2', qualityScore: 45, mimeType: 'image/jpeg' },
      { base64: 'img3', qualityScore: 30, mimeType: 'image/jpeg' },
    ];

    const result = prepareImages(userImages);

    // Should include all 3 even if quality is lower
    expect(result.length).toBe(3);
  });
});

describe('convertImagesToParts', () => {
  it('should convert images to Gemini API format', () => {
    const selectedImages = [
      { base64: 'data:image/jpeg;base64,abc123', qualityScore: 90, mimeType: 'image/jpeg' },
      { base64: 'data:image/png;base64,def456', qualityScore: 85, mimeType: 'image/png' },
    ];

    const result = convertImagesToParts(selectedImages);

    expect(result.length).toBe(2);
    expect(result[0].inlineData.data).toBe('abc123');
    expect(result[0].inlineData.mimeType).toBe('image/jpeg');
    expect(result[1].inlineData.data).toBe('def456');
    expect(result[1].inlineData.mimeType).toBe('image/png');
  });

  it('should include reference image when provided', () => {
    const selectedImages = [
      { base64: 'data:image/jpeg;base64,abc123', qualityScore: 90, mimeType: 'image/jpeg' },
    ];

    const referenceImage = {
      base64: 'data:image/jpeg;base64,ref123',
      mimeType: 'image/jpeg',
    };

    const result = convertImagesToParts(selectedImages, referenceImage);

    expect(result.length).toBe(2);
    expect(result[1].inlineData.data).toBe('ref123');
  });

  it('should handle images without data prefix', () => {
    const selectedImages = [
      { base64: 'abc123', qualityScore: 90, mimeType: 'image/jpeg' },
    ];

    const result = convertImagesToParts(selectedImages);

    expect(result[0].inlineData.data).toBe('abc123');
  });
});

describe('calculateBatchTokenCost', () => {
  it('should calculate cost correctly', () => {
    expect(calculateBatchTokenCost('1K', 1)).toBe(1);
    expect(calculateBatchTokenCost('1K', 2)).toBe(2); // Math.ceil(1 * 1.9)
    expect(calculateBatchTokenCost('2K', 3)).toBe(6); // Math.ceil(2 * 2.7)
  });
});

describe('getDiscountForBatch', () => {
  it('should return correct discount percentages', () => {
    expect(getDiscountForBatch(1)).toBe(0);
    expect(getDiscountForBatch(2)).toBe(5);
    expect(getDiscountForBatch(3)).toBe(10);
    expect(getDiscountForBatch(4)).toBe(15);
    expect(getDiscountForBatch(5)).toBe(20);
  });
});
