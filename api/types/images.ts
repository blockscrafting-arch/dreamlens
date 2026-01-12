/**
 * Types for image processing and safety settings
 */

export interface ImageWithQuality {
  base64: string;
  qualityScore?: number;
  mimeType?: string;
}

export type SafetyCategory = 
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT';

export type SafetyThreshold = 
  | 'BLOCK_NONE'
  | 'BLOCK_ONLY_HIGH'
  | 'BLOCK_MEDIUM_AND_ABOVE'
  | 'BLOCK_LOW_AND_ABOVE';

export interface SafetySetting {
  category: SafetyCategory;
  threshold: SafetyThreshold;
}

