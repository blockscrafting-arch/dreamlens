/**
 * POST /api/generate/idea - Generate creative idea for "I'm Feeling Lucky"
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '../utils/auth.js';
import * as UserService from '../services/user.service.js';
import { checkRateLimit, recordUsage } from '../utils/rateLimit.js';
import { successResponse, errorResponse, unauthorizedResponse, rateLimitResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';
import { tryWithFallback, getGeminiApiKeys } from '../utils/geminiKeys.js';
import { getClientIp } from '../utils/ip.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);
    
    // Check if at least one API key is available
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      logger.error('GEMINI_API_KEY is not set in environment variables', undefined, {
        message: 'Server configuration error: Gemini API key missing'
      });
      return response.status(500).json(
        errorResponse('Сервер не настроен. Обратитесь к администратору.', 500, undefined, requestOrigin)
      );
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return response.status(401).json(unauthorizedResponse(requestOrigin));
    }

    // Get user
    const user = auth.authType === 'device' 
      ? await UserService.getOrCreateUserByDeviceId(auth.userId)
      : await UserService.getOrCreateUserByClerkId(auth.userId);

    // Extract client IP for rate limiting
    const ipAddress = getClientIp(request);

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, 'generation', 10, 60000, ipAddress, auth.authType);
    if (!rateLimit.allowed) {
      return response.status(429).json(
        rateLimitResponse(Math.ceil((rateLimit.resetTime - Date.now()) / 1000), requestOrigin)
      );
    }

    // Inject Randomness to prevent duplicates - expanded themes for variety
    const themes = [
      // Fashion & Style
      'High Fashion Editorial', 'Streetwear Culture', 'Avant-Garde Couture', 'Minimalist Elegance',
      // Sci-Fi & Future
      'Cyberpunk Future', 'Biopunk Laboratory', 'Space Explorer', 'Post-Apocalyptic Survivor',
      // Historical & Classic
      'Renaissance Oil Painting', 'Vintage 1950s', 'Victorian Gothic', 'Ancient Greek Mythology',
      // Fantasy & Magic
      'Ethereal Fairy Tale', 'Dark Sorcerer', 'Steampunk Inventor', 'Nature Spirit',
      // Cinema & Art
      'Cinematic Movie Still', 'Film Noir Detective', 'Abstract Art Portrait', 'Wes Anderson Aesthetic',
      // Atmosphere & Mood
      'Neon Noir', 'Golden Hour Dream', 'Rainy Night Melancholy', 'Misty Mountain Wanderer',
      // Power & Status
      'Royal Aristocracy', 'Corporate Mogul', 'Underground Artist', 'Sports Champion'
    ];
    
    // Random modifiers for extra variety
    const timeOfDay = ['at dawn', 'at golden hour', 'at twilight', 'at midnight', 'in morning mist'][Math.floor(Math.random() * 5)];
    const mood = ['mysterious', 'powerful', 'serene', 'dramatic', 'ethereal'][Math.floor(Math.random() * 5)];
    
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const seed = Math.floor(Math.random() * 100000);

    try {
      // Use tryWithFallback to automatically switch to backup key on retryable errors
      const geminiResponse = await tryWithFallback(
        async (apiKey: string) => {
          const ai = new GoogleGenAI({ apiKey });
          return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [{
                text: `Act as a creative director. Generate ONE unique, vivid, and artistic photoshoot concept for a portrait based on the theme: "${randomTheme}" ${timeOfDay}, with a ${mood} atmosphere.
            
CRITICAL RULES:
1. Output MUST be in Russian language.
2. Format: ONE complete sentence, 20-40 words. NO lists, NO bullet points.
3. The sentence MUST end with a period (.).
4. Describe: subject, clothing/style, lighting, atmosphere.
5. Make it sound expensive and cinematic.
6. Random Seed: ${seed}.

IMPORTANT: Output ONLY the descriptive sentence. No explanations. Must be grammatically complete and end with a period.

Good examples:
"Портрет в лучах закатного солнца, модель в полупрозрачном шелковом наряде, вокруг летают золотые пылинки, создавая атмосферу магического реализма."
"Воин в сияющих доспехах стоит на краю утеса, драматичное грозовое небо и молнии освещают сцену в эпических тонах."
"Загадочный силуэт в винтажном кафе Парижа, мягкий свет сквозь кружевные шторы, атмосфера французского нуара."
`
              }]
            },
            config: {
              temperature: 1.0,
              topK: 40,
              maxOutputTokens: 600,
            }
          });
        },
        {
          operation: 'generateIdea',
          theme: randomTheme,
          userId: user.id?.substring(0, 8) + '...',
        }
      );
      
      // Fallback ideas for when generation fails or is incomplete
      const fallbacks = [
        "Футуристический портрет в неоновом киберпространстве, окруженный цифровыми карпами кои, мягкое фиолетовое свечение.",
        "Монарх пчелиного улья в золотых сотах, стекающий мед, макросъемка, высокая мода и глянцевая кожа.",
        "Ретро-портрет в стиле 1920-х годов на поверхности Луны, черно-белый стиль с зерном и космическим светом.",
        "Лесной дух в современном супермаркете, выбирающий магические зелья, контрастный неоновый свет витрин.",
        "Портрет в стиле Густава Климта, золотые узоры на коже, элементы киберпанка и микросхемы в волосах.",
        "Пилот гигантского робота отдыхает на закате, индустриальный пейзаж, теплый оранжевый свет и дым.",
        "Маг в вагоне метро, читающий древний свиток, магическое зеленое свечение из книги, кинематографичный реализм.",
        "Аристократ в заброшенной библиотеке, пыль в лучах света, атмосфера тайного общества и старых книг.",
        "Путешественник во времени на крыше небоскреба, городские огни внизу, драматичный закат и ветер.",
        "Алхимик в лаборатории с колбами и зельями, дым и цветные отражения, атмосфера научной фантастики.",
        "Рыцарь в сияющих доспехах на фоне заката, драматичные облака и лучи света сквозь шлем.",
        "Исследователь в джунглях древнего храма, золотой свет и тени от лиан, атмосфера приключений.",
        "Музыкант на сцене джаз-клуба, синий дым и прожекторы, ностальгическая атмосфера 1960-х.",
        "Астронавт на поверхности чужой планеты, отражение звезд в шлеме, космическое одиночество."
      ];

      let text = geminiResponse.text?.trim();
      
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
      
      // If text is incomplete, use fallback instead of throwing error
      if (!text || text.length < 20 || !isComplete) {
        logger.logApiInfo('generateIdea - using fallback due to incomplete response', {
          theme: randomTheme,
          textLength: text?.length || 0,
          isComplete,
        });
        const fallbackIdea = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        
        // Record usage even for fallback
        await recordUsage(user.id, 'generation', ipAddress);
        
        return response.status(200).json(
          successResponse({ idea: fallbackIdea }, undefined, requestOrigin)
        );
      }

      // Record usage
      await recordUsage(user.id, 'generation', ipAddress);

      return response.status(200).json(
        successResponse({ idea: text }, undefined, requestOrigin)
      );
    } catch (error) {
      logger.logApiError('generateIdea', error instanceof Error ? error : new Error(String(error)), {
        theme: randomTheme,
        userId: user.id?.substring(0, 8) + '...',
      });
      
      // Fallback ideas (last resort if all API keys fail)
      const fallbacks = [
        "Футуристический портрет в неоновом киберпространстве, окруженный цифровыми карпами кои, мягкое фиолетовое свечение.",
        "Монарх пчелиного улья в золотых сотах, стекающий мед, макросъемка, высокая мода и глянцевая кожа.",
        "Ретро-портрет в стиле 1920-х годов на поверхности Луны, черно-белый стиль с зерном и космическим светом.",
        "Лесной дух в современном супермаркете, выбирающий магические зелья, контрастный неоновый свет витрин.",
        "Портрет в стиле Густава Климта, золотые узоры на коже, элементы киберпанка и микросхемы в волосах.",
        "Пилот гигантского робота отдыхает на закате, индустриальный пейзаж, теплый оранжевый свет и дым.",
        "Маг в вагоне метро, читающий древний свиток, магическое зеленое свечение из книги, кинематографичный реализм.",
        "Аристократ в заброшенной библиотеке, пыль в лучах света, атмосфера тайного общества и старых книг.",
        "Путешественник во времени на крыше небоскреба, городские огни внизу, драматичный закат и ветер.",
        "Алхимик в лаборатории с колбами и зельями, дым и цветные отражения, атмосфера научной фантастики."
      ];
      
      const fallbackIdea = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      
      return response.status(200).json(
        successResponse({ idea: fallbackIdea }, undefined, requestOrigin)
      );
    }
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('generateIdea', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}

