/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateApiKey,
  validateFileSize,
  validateImageType,
  sanitizePrompt,
  validateFiles,
} from '../../utils/validation';

describe('validateApiKey', () => {
  it('should validate correct Google Gemini API key format', () => {
    expect(validateApiKey('AIzaSy12345678901234567890123456789012345')).toBe(true);
    expect(validateApiKey('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567')).toBe(true);
  });

  it('should reject invalid API keys', () => {
    expect(validateApiKey('invalid-key')).toBe(false);
    expect(validateApiKey('AIzaSy')).toBe(false);
    expect(validateApiKey('AIzaSy123')).toBe(false);
    expect(validateApiKey('')).toBe(false);
    expect(validateApiKey(null)).toBe(false);
    expect(validateApiKey(undefined)).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('should validate file size within limit', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    // Mock file size (5MB)
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });
    expect(validateFileSize(file, 10)).toBe(true);
  });

  it('should reject files exceeding size limit', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    // Mock file size (15MB)
    Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 });
    expect(validateFileSize(file, 10)).toBe(false);
  });
});

describe('validateImageType', () => {
  it('should validate allowed image types', () => {
    expect(validateImageType(new File([''], 'test.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(validateImageType(new File([''], 'test.png', { type: 'image/png' }))).toBe(true);
    expect(validateImageType(new File([''], 'test.webp', { type: 'image/webp' }))).toBe(true);
  });

  it('should reject non-image types', () => {
    expect(validateImageType(new File([''], 'test.pdf', { type: 'application/pdf' }))).toBe(false);
    expect(validateImageType(new File([''], 'test.txt', { type: 'text/plain' }))).toBe(false);
  });
});

describe('sanitizePrompt', () => {
  it('should sanitize prompt text', () => {
    expect(sanitizePrompt('  test prompt  ')).toBe('test prompt');
    expect(sanitizePrompt('test<prompt>')).toBe('testprompt');
    expect(sanitizePrompt('test<script>alert("xss")</script>')).toBe('testalert("xss")');
  });

  it('should limit prompt length', () => {
    const longPrompt = 'a'.repeat(2000);
    expect(sanitizePrompt(longPrompt).length).toBeLessThanOrEqual(1000);
  });
});

describe('validateFiles', () => {
  it('should validate multiple files', () => {
    const files = [
      new File([''], 'test1.jpg', { type: 'image/jpeg' }),
      new File([''], 'test2.png', { type: 'image/png' }),
    ];
    Object.defineProperty(files[0], 'size', { value: 5 * 1024 * 1024 });
    Object.defineProperty(files[1], 'size', { value: 3 * 1024 * 1024 });

    const result = validateFiles(files);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject too many files', () => {
    const files = Array.from({ length: 25 }, (_, i) =>
      new File([''], `test${i}.jpg`, { type: 'image/jpeg' })
    );
    const result = validateFiles(files);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});


