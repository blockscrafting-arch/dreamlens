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

    // Trendy themes for young fashion-forward audience
    const themes = [
      // 2025 Hot Trends
      'Mob Wife Aesthetic with leopard fur and gold chains',
      'Office Siren with glasses and dangerous elegance',
      'Italian Tomato Girl summer in terracotta linen',
      'Quiet Luxury editorial with The Row aesthetics',
      'A La Russe winter aristocrat with fur and pearls',
      // Cinema Vibes
      'Wong Kar-wai movie still with neon city lights',
      'Sofia Coppola dreamy pastel romantic scene',
      'Indie Sleaze party flash photography',
      'Film Noir mystery in black and white',
      // Fashion Editorial
      'Dazed Magazine avant-garde cover shoot',
      'Vogue Italia high fashion editorial',
      'Balenciaga futuristic campaign',
      'The Row minimalist campaign',
      // Digital Future
      'Y3K cyber angel with holographic halo',
      'Liquid chrome Blade Runner portrait',
      'Digital divinity with data streams',
      // Lifestyle Aesthetics  
      'Princess Diana off-duty gym moment',
      'Y2K Paris Hilton era with rhinestones',
      'Coastal cowgirl at golden hour beach',
      'Cottagecore Pride & Prejudice scene',
      // Art & Fantasy
      'Ethereal elf queen with bioluminescent glow',
      'Dark academia secret library portrait',
      'Soft goth romantic with velvet and roses',
      '90s grunge revival raw aesthetic'
    ];
    
    // Random modifiers for extra variety
    const timeOfDay = ['at golden hour', 'at blue hour', 'at sunset', 'late at night', 'in soft morning light'][Math.floor(Math.random() * 5)];
    const mood = ['mysterious', 'powerful', 'dreamy', 'cinematic', 'ethereal'][Math.floor(Math.random() * 5)];
    
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
      
      // Fashion-forward fallback ideas for young audience
      const fallbacks = [
        "Утро после вечеринки в Берлине: мятая шелковая рубашка, растрепанные волосы, мягкий свет через грязное окно лофта.",
        "Редактор Vogue на кофе-брейке в Милане: oversized кашемир, минимум макияжа, уверенный взгляд через стекло кофейни.",
        "Mob wife выходит из черного Escalade: леопардовая шуба, массивные золотые серьги, дерзкий взгляд на папарацци.",
        "Кинематографичный кадр в такси ночного Токио: неоновые отражения на лице, меланхоличная романтика Wong Kar-wai.",
        "Русская аристократка в заснеженном лесу: винтажный мех, жемчуг, красные губы на фоне берез и снега.",
        "Office siren после работы: очки на кончике носа, расстегнутая блузка, опасная интеллектуальная энергия.",
        "Итальянское лето на террасе: терракотовый лён, золотой загар, бокал просекко и лимонное дерево.",
        "Цифровой ангел в белом void-пространстве: голографическое гало из данных, стеклянная кожа, Y3K эстетика.",
        "Последний танец в заброшенном особняке: бархатное платье, свечи, романтический gothic-декаданс.",
        "Indie sleaze 2010: прямая вспышка, размазанная подводка, блестки и шампанское в 4 утра.",
        "Quiet luxury момент: кашемир oatmeal цвета, чистая кожа, никаких логотипов, озеро Комо за окном.",
        "Балерина после репетиции: пуанты и ribbons, уставшая грация, пыль в луче света из окна студии.",
        "Coastal cowgirl на закате: ковбойская шляпа, развевающееся платье, океан и золотое солнце.",
        "Grunge revival: фланель, мешковатые джинсы, raw энергия и полное безразличие к камере."
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
      
      // Fashion-forward fallback ideas (last resort if all API keys fail)
      const fallbacks = [
        "Кинематографичный портрет в ночном такси: неоновые огни отражаются на лице, Wong Kar-wai меланхолия.",
        "Mob wife в леопардовой шубе на фоне мраморной лестницы: золотые серьги, красные ногти, дерзкий взгляд.",
        "Office siren на закате в пустом офисе: очки, строгий пучок, опасная интеллектуальная красота.",
        "Итальянское лето на Амальфи: лён терракотового цвета, золотой загар, лимоны и солнце.",
        "Русская зима в меховой шапке: красные губы, жемчуг, заснеженные берёзы на фоне.",
        "Coquette эстетика: шёлковые ленты, розовая дымка, мечтательный взгляд Sofia Coppola.",
        "Y3K ангел в белом пространстве: голографическое гало, стеклянная кожа, цифровое совершенство.",
        "Indie sleaze вечеринка: прямая вспышка, блёстки, 3 утра и шампанское.",
        "Dark academia в старой библиотеке: твид, свечи, пыль в лучах света, тайное общество.",
        "Quiet luxury момент: кашемир без логотипов, озеро Комо, генерационное богатство."
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

