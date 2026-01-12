/**
 * @deprecated This file contains client-side functions that are no longer used.
 * All generation now happens server-side via /api/generate endpoints.
 * These functions are kept for reference but should not be imported in client code.
 * Server-side generation logic is in api/generate/index.ts
 */

import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, UserImage } from '../types';
import { getTrendPrompt } from '../prompts/trendPrompts';
import { resizeImage } from '../utils/helpers';
import { validateApiKey, sanitizePrompt } from '../utils/validation';
import { logger } from '../utils/logger';

// Helper to prepare image part using the resizing utility
const prepareImagePart = async (file: File) => {
  try {
      // Resize to max 1024px to ensure API stability and speed
      const base64Data = await resizeImage(file, 1024);
      return {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg', // We convert everything to optimized JPEG
        },
      };
  } catch (e) {
      console.error("Image processing failed", e);
      throw new Error("Не удалось обработать одно из изображений.");
  }
};

// NEW: Fast creative prompt generator for "I'm Feeling Lucky"
export const generateCreativeIdea = async (apiKey: string): Promise<string> => {
  if (!apiKey || !validateApiKey(apiKey)) {
    throw new Error("API ключ не найден или невалиден.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // 1. Inject Randomness to prevent duplicates
  const themes = [
      'High Fashion Editorial', 'Cyberpunk Future', 'Renaissance Oil Painting', 
      'Ethereal Fairy Tale', 'Cinematic Movie Still', 'Abstract Art Portrait',
      'Vintage 1950s', 'Neon Noir', 'Royal Aristocracy', 'Nature Spirit'
  ];
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  const seed = Math.floor(Math.random() * 100000);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{
            text: `Act as a creative director. Generate ONE unique, vivid, and artistic photoshoot concept for a portrait based on the theme: "${randomTheme}".
            
CRITICAL RULES:
1. Output MUST be in Russian language.
2. Format: ONE complete sentence, 20-40 words. NO lists, NO bullet points.
3. The sentence MUST end with a period (.).
4. Describe: subject, clothing/style, lighting, atmosphere.
5. Make it sound expensive and cinematic.
6. Random Seed: ${seed}.

IMPORTANT: Output ONLY the descriptive sentence. No explanations. Must be grammatically complete and end with a period.

Good examples:
"Портрет в лучах закатного солнца, модель в полупрозрачном шелковом платье, вокруг летают золотые пылинки, создавая атмосферу магического реализма."
"Девушка-воин в сияющих доспехах стоит на краю утеса, драматичное грозовое небо и молнии освещают сцену в эпических тонах."
"Загадочная незнакомка в винтажном кафе Парижа, мягкий свет сквозь кружевные шторы, атмосфера французского нуара."
`
        }]
      },
      config: {
        temperature: 1.0,
        topK: 40,
        maxOutputTokens: 400,
      }
    });
    
    let text = response.text?.trim();
    
    // Clean up the text
    if (text) {
        // Remove surrounding quotes
        text = text.replace(/^["'«]|["'»]$/g, '');
        // Remove trailing artifacts like "; " or ", " or incomplete words
        text = text.replace(/[,;:\s]+$/g, '');
        // Remove incomplete endings (word fragments after last complete sentence)
        const lastSentenceEnd = Math.max(
          text.lastIndexOf('.'),
          text.lastIndexOf('!'),
          text.lastIndexOf('?')
        );
        if (lastSentenceEnd > 20) {
          text = text.substring(0, lastSentenceEnd + 1);
        }
        text = text.trim();
    }
    
    // Validation: check if text is complete (ends with sentence-ending punctuation)
    const isComplete = text && /[.!?]$/.test(text) && text.length >= 30;
    
    if (!text || text.length < 20 || !isComplete) {
        console.warn("Gemini returned incomplete text:", response);
        throw new Error("Generated text incomplete or too short");
    }
    
    return text;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    logger.logApiError('generateCreativeIdea', error, { theme: randomTheme });
    // Creative Fallbacks (Surreal & Mix)
    const fallbacks = [
        "Футуристическая гейша в неоновом киберпространстве, окруженная цифровыми карпами кои, мягкое фиолетовое свечение.",
        "Королева пчел в золотых сотах, стекающий мед, макросъемка, высокая мода и глянцевая кожа.",
        "Девушка из 1920-х годов играет в теннис на поверхности Луны, ретро-фантастика, черно-белый стиль с зерном.",
        "Лесная нимфа в современном супермаркете, выбирающая магические зелья, контрастный неоновый свет витрин.",
        "Портрет в стиле Густава Климта, золотые узоры на коже, элементы киберпанка и микросхемы в волосах.",
        "Девушка-пилот гигантского робота отдыхает на закате, индустриальный пейзаж, теплый оранжевый свет.",
        "Ведьма в вагоне метро, читающая древний свиток, магическое зеленое свечение из книги, реализм."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

export const generateDreamImage = async (
  userImages: UserImage[],
  config: GenerationConfig,
  apiKey: string
): Promise<string> => {
  if (!apiKey || !validateApiKey(apiKey)) {
    throw new Error("API ключ не найден или невалиден. Пожалуйста, подключите его.");
  }

  // Validate user images
  if (!userImages || userImages.length < 3) {
    throw new Error("Недостаточно изображений. Загрузите минимум 3 фото.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Prepare User Images (Context)
  // OPTIMIZATION: Even if user uploads 20, we only take the top 5 BEST photos.
  const sortedImages = [...userImages].sort((a, b) => b.qualityScore - a.qualityScore);
  
  let selectedImages = sortedImages.filter(img => img.qualityScore > 40).slice(0, 5);
  if (selectedImages.length < 3) {
      selectedImages = sortedImages.slice(0, 3);
  }
  
  // Process images in parallel
  const imageParts = await Promise.all(selectedImages.map(img => prepareImagePart(img.file)));

  // 2. Prepare Reference Image if exists
  if (config.referenceImage) {
    const refPart = await prepareImagePart(config.referenceImage);
    // Append ref image to the END of the array
    imageParts.push(refPart);
  }

  // 3. Get the specialized prompt based on Trend AND Refinement
  // Passed hasReference flag so prompt knows the last image is special
  // Sanitize user prompts to prevent injection
  const sanitizedUserPrompt = config.userPrompt ? sanitizePrompt(config.userPrompt) : undefined;
  const sanitizedRefinement = config.refinementText ? sanitizePrompt(config.refinementText) : undefined;
  
  const { systemInstruction, mainPrompt } = getTrendPrompt(
      config.trend, 
      config.dominantColor, 
      sanitizedUserPrompt,
      sanitizedRefinement,
      !!config.referenceImage
  );

  // 4. Construct Content
  // We use the generated prompt which already includes logic for references
  const finalPrompt = `
    ${mainPrompt}
    
    CRITICAL EXECUTION:
    1. FACE: Must look exactly like the user (first ${selectedImages.length} images).
    2. QUALITY: Cinematic, detailed, expensive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Neural Texture Engine
      contents: {
        parts: [
          ...imageParts,
          { text: finalPrompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: config.ratio,
          imageSize: config.quality
        },
        systemInstruction: systemInstruction,
        safetySettings: [
            // Restore reasonable safety settings for production
            // BLOCK_MEDIUM_AND_ABOVE blocks harmful content while allowing creative prompts
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any }
        ] as any
      }
    });

    // 5. Extract Image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("Нейросеть посчитала запрос небезопасным (Safety Filter). Попробуйте выбрать другой стиль или фото.");
    }

    throw new Error("Не удалось сгенерировать изображение. Попробуйте еще раз.");

  } catch (error: any) {
    const apiError = error instanceof Error ? error : new Error(String(error));
    logger.logApiError('generateDreamImage', apiError, {
      imageCount: selectedImages.length,
      hasReference: !!config.referenceImage,
      trend: config.trend,
      quality: config.quality,
    });
    
    // User-friendly error mapping
    if (error.message?.includes('429') || error.message?.includes('quota')) {
        throw new Error("Слишком много запросов. Подождите минуту и попробуйте снова.");
    }
    if (error.message?.includes('413')) {
        throw new Error("Файлы слишком большие. Попробуйте загрузить меньше фото.");
    }
    if (error.message?.includes('SAFETY')) {
        throw new Error("Сработал фильтр безопасности. Попробуйте сменить стиль или фото.");
    }

    throw error;
  }
};