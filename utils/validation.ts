/**
 * Validation utilities for user inputs and API keys
 */

/**
 * Validates Google Gemini API key format
 * Format: AIzaSy followed by alphanumeric characters (typically 35+ chars, but length may vary)
 */
export const validateApiKey = (key: string | null | undefined): boolean => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  const trimmed = key.trim();
  
  // Google Gemini API keys start with "AIzaSy" and have at least 30 characters total
  // (6 for "AIzaSy" + at least 24 more characters)
  // Some keys may be longer, so we check minimum length instead of exact
  if (trimmed.length < 30) {
    return false;
  }
  
  // Must start with "AIzaSy" followed by alphanumeric characters, hyphens, or underscores
  const apiKeyPattern = /^AIzaSy[0-9A-Za-z_-]+$/;
  return apiKeyPattern.test(trimmed);
};

/**
 * Validates file size (max 10MB per file)
 */
export const validateFileSize = (file: File, maxSizeMB: number = 10): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validates image MIME type
 */
export const validateImageType = (file: File): boolean => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  return allowedTypes.includes(file.type.toLowerCase());
};

/**
 * Sanitizes user prompt text to prevent injection attacks
 */
export const sanitizePrompt = (text: string): string => {
  // Remove potentially dangerous characters but keep Russian/Cyrillic
  // Allow letters, numbers, spaces, punctuation, and Cyrillic characters
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 1000); // Limit length
};

/**
 * Validates multiple files for upload
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateFiles = (files: File[]): FileValidationResult => {
  const errors: string[] = [];
  
  if (files.length === 0) {
    return { valid: false, errors: ['Не выбрано ни одного файла'] };
  }
  
  if (files.length > 20) {
    errors.push('Максимум 20 файлов за раз');
  }
  
  files.forEach((file, index) => {
    if (!validateImageType(file)) {
      errors.push(`Файл ${index + 1} (${file.name}): неподдерживаемый формат. Используйте JPEG, PNG, WebP или GIF`);
    }
    
    if (!validateFileSize(file, 10)) {
      errors.push(`Файл ${index + 1} (${file.name}): размер превышает 10MB`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
};


