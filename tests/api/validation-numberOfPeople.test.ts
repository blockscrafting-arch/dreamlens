/**
 * Unit tests for numberOfPeople validation
 */

import { describe, it, expect } from 'vitest';
import { validateImageGenerationRequest } from '../../api/utils/validation';

describe('validateImageGenerationRequest - numberOfPeople', () => {
  const baseRequest = {
    userImages: [
      { base64: 'data:image/jpeg;base64,abc123' },
      { base64: 'data:image/jpeg;base64,def456' },
      { base64: 'data:image/jpeg;base64,ghi789' },
    ],
    config: {
      quality: '1K' as const,
      ratio: '3:4' as const,
      trend: 'MAGAZINE',
      imageCount: 1,
    },
  };

  it('should accept valid numberOfPeople = 1', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 1,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(true);
  });

  it('should accept valid numberOfPeople = 2', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 2,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(true);
  });

  it('should reject numberOfPeople = 0', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 0,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(false);
  });

  it('should accept numberOfPeople = 3', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 3,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(true);
  });

  it('should accept numberOfPeople = 4', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 4,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(true);
  });

  it('should reject numberOfPeople > 4', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 5,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(false);
  });

  it('should reject negative numberOfPeople', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: -1,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(false);
  });

  it('should reject non-integer numberOfPeople', () => {
    const request = {
      ...baseRequest,
      config: {
        ...baseRequest.config,
        numberOfPeople: 1.5,
      },
    };

    expect(validateImageGenerationRequest(request)).toBe(false);
  });

  it('should accept request without numberOfPeople (defaults to 1)', () => {
    expect(validateImageGenerationRequest(baseRequest)).toBe(true);
  });
});
