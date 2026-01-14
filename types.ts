export enum TrendType {
  // Editorial & High Fashion
  MAGAZINE = 'MAGAZINE',
  PROFESSIONAL = 'PROFESSIONAL',
  
  // Cinema & Atmosphere
  COUPLE = 'COUPLE',
  RETRO_2K17 = 'RETRO_2K17',
  DARK_ACADEMIA = 'DARK_ACADEMIA',
  
  // Luxury & Status
  OLD_MONEY = 'OLD_MONEY',
  MOB_WIFE = 'MOB_WIFE',
  A_LA_RUSSE = 'A_LA_RUSSE',
  
  // Modern Feminine
  OFFICE_SIREN = 'OFFICE_SIREN',
  COQUETTE = 'COQUETTE',
  CLEAN_GIRL = 'CLEAN_GIRL',
  
  // Digital & Futuristic
  CYBER_ANGEL = 'CYBER_ANGEL',
  NEON_CYBER = 'NEON_CYBER',
  
  // Lifestyle & Vibe
  SPORT_CHIC = 'SPORT_CHIC',
  Y2K_POP = 'Y2K_POP',
  COTTAGECORE = 'COTTAGECORE',
  
  // Art & Fantasy
  ETHEREAL = 'ETHEREAL',
  MINIMALIST = 'MINIMALIST',
  
  // NEW Wave 4 - 2025 Trends
  TOMATO_GIRL = 'TOMATO_GIRL',
  COASTAL_COWGIRL = 'COASTAL_COWGIRL',
  QUIET_LUXURY = 'QUIET_LUXURY',
  BALLETCORE = 'BALLETCORE',
  GRUNGE_REVIVAL = 'GRUNGE_REVIVAL',
  SOFT_GOTH = 'SOFT_GOTH',
  
  // Custom
  CUSTOM = 'CUSTOM',
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
  file?: File;
  previewUrl: string;
  url?: string; // URL on CDN if uploaded
  onServer?: boolean; // Flag to indicate it's already on server
  qualityScore: number; // 0 to 100
  feedback?: string; // Specific advice like "Too dark", "Low res"
}

export interface GenerationConfig {
  trend: TrendType;
  ratio: AspectRatio;
  quality: ImageQuality;
  imageCount: number; // 1-5, number of images to generate
  numberOfPeople?: number; // 1-4, поддержка парных/групповых кадров
  dominantColor?: string;
  userPrompt?: string;
  referenceImage?: File; // For drag and drop reference
  refinementText?: string; // NEW: For "Edit this image" functionality
}

/**
 * Single generated image result
 */
export interface GeneratedImage {
  imageUrl: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface GeneratedResult {
  id: string;
  timestamp: number;
  images: GeneratedImage[]; // Array of generated images
  promptUsed: string;
  trend: TrendType;
  // Backward compatibility - primary image URL
  imageUrl?: string;
}
