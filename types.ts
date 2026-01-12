export enum TrendType {
  MAGAZINE = 'MAGAZINE',
  COUPLE = 'COUPLE',
  RETRO_2K17 = 'RETRO_2K17',
  PROFESSIONAL = 'PROFESSIONAL',
  CUSTOM = 'CUSTOM',
  // New Styles
  OLD_MONEY = 'OLD_MONEY',
  ETHEREAL = 'ETHEREAL',
  OFFICE_SIREN = 'OFFICE_SIREN',
  MINIMALIST = 'MINIMALIST',
  NEON_CYBER = 'NEON_CYBER',
  // Wave 2 additions
  COQUETTE = 'COQUETTE',
  DARK_ACADEMIA = 'DARK_ACADEMIA',
  Y2K_POP = 'Y2K_POP',
  COTTAGECORE = 'COTTAGECORE',
  // Wave 3 (Super Trendy)
  A_LA_RUSSE = 'A_LA_RUSSE',
  MOB_WIFE = 'MOB_WIFE',
  CYBER_ANGEL = 'CYBER_ANGEL',
  SPORT_CHIC = 'SPORT_CHIC'
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '3:4',
  LANDSCAPE = '4:3',
  STORY = '9:16',
  CINEMATIC = '16:9'
}

export enum ImageQuality {
  STD = '1K',
  HD = '2K',
  UHD = '4K'
}

export interface UserImage {
  file: File;
  previewUrl: string;
  qualityScore: number; // 0 to 100
  feedback?: string; // Specific advice like "Too dark", "Low res"
}

export interface GenerationConfig {
  trend: TrendType;
  ratio: AspectRatio;
  quality: ImageQuality;
  dominantColor?: string;
  userPrompt?: string;
  referenceImage?: File; // For drag and drop reference
  refinementText?: string; // NEW: For "Edit this image" functionality
}

export interface GeneratedResult {
  id: string;
  timestamp: number;
  imageUrl: string;
  promptUsed: string;
  trend: TrendType;
}