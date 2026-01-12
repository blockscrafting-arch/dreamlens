/**
 * POST /api/generate/image - Generate image using Gemini API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import * as AuthService from '../services/auth.service.js';
import { checkRateLimit, recordUsage } from '../utils/rateLimit.js';
import { successResponse, errorResponse, unauthorizedResponse, rateLimitResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';
import { logger } from '../utils/logger.js';
import { tryWithFallback, getGeminiApiKeys } from '../utils/geminiKeys.js';
import { getClientIp } from '../utils/ip.js';
import { 
  validatePayloadSize, 
  validateRequestBody, 
  getRequestBody,
  validateImageGenerationRequest,
  type ImageGenerationRequestBody 
} from '../utils/validation.js';
import { HarmCategory, SafetySetting } from '@google/genai';
import { TrendType } from '../../types.js';
import * as GenerationService from '../services/generation.service.js';
import * as TokenService from '../services/token.service.js';
import * as SubscriptionService from '../services/subscription.service.js';
import { sql } from '../repositories/database.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    setCorsHeaders(response, requestOrigin);

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    // Validate payload size (DoS protection)
    try {
      validatePayloadSize(request);
    } catch (error) {
      return response.status(413).json(
        errorResponse('Payload too large', 413, undefined, requestOrigin)
      );
    }
    
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

    // Get authenticated user (verifies auth and gets/creates user atomically)
    let authenticatedUser;
    try {
      authenticatedUser = await AuthService.getAuthenticatedUser(request);
    } catch (error) {
      return response.status(401).json(unauthorizedResponse(requestOrigin));
    }

    const { user } = authenticatedUser;

    // Validate payload size
    validatePayloadSize(request);

    // Extract client IP for rate limiting
    const ipAddress = getClientIp(request);

    // Validate and extract request body
    validateRequestBody(request);
    const body = getRequestBody<ImageGenerationRequestBody>(request);
    
    // Log request body for debugging (without full base64 data)
    // Use type assertion for safe property access before validation
    const debugBody = body as Record<string, any>;
    logger.logApiInfo('Image generation request received', {
      userImagesCount: Array.isArray(debugBody.userImages) ? debugBody.userImages.length : 0,
      hasConfig: !!debugBody.config,
      configTrend: debugBody.config?.trend,
      configQuality: debugBody.config?.quality,
      configRatio: debugBody.config?.ratio,
      userImagesSample: Array.isArray(debugBody.userImages) 
        ? debugBody.userImages.slice(0, 3).map((img: any) => ({
            hasBase64: !!img.base64,
            base64Length: img.base64?.length || 0,
            hasQualityScore: typeof img.qualityScore === 'number',
          }))
        : [],
    });
    
    // Validate request body structure
    if (!validateImageGenerationRequest(body)) {
      logger.logApiError('Image generation validation failed', new Error('Invalid request body'), {
        userImagesCount: Array.isArray(debugBody.userImages) ? debugBody.userImages.length : 'not an array',
        userImagesType: Array.isArray(debugBody.userImages) ? 'array' : typeof debugBody.userImages,
        hasConfig: !!debugBody.config,
        bodyKeys: debugBody && typeof debugBody === 'object' ? Object.keys(debugBody) : [],
      });
      return response.status(400).json(
        errorResponse('Недостаточно изображений. Загрузите минимум 3 фото.', 400, undefined, requestOrigin)
      );
    }

    const { userImages, config } = body;

    // Validate trend against enum
    if (!Object.values(TrendType).includes(config.trend as TrendType)) {
      return response.status(400).json(
        errorResponse('Неверный тип стиля', 400, undefined, requestOrigin)
      );
    }
    
    // Validate trend against TrendType enum
    const trendType = config.trend as any;
    const isValidTrend = Object.values(TrendType).includes(trendType);
    if (!isValidTrend) {
      return response.status(400).json(
        errorResponse('Неверный тип стиля', 400, undefined, requestOrigin)
      );
    }

    // Determine token cost
    const qualityValue = config.quality || '1K';
    const tokenCost = GenerationService.calculateTokenCost(qualityValue);

    // Get subscription and limits
    const subscription = await SubscriptionService.getUserSubscription(user.id);
    const plan = subscription?.plan || 'free';
    const limits = SubscriptionService.getSubscriptionLimits(plan);
    
    // Check if quality is allowed for the plan
    const qualityAllowed = (quality: string, planQuality: string): boolean => {
      const qualityOrder = { '1K': 1, '2K': 2, '4K': 3 };
      const requested = qualityOrder[quality as keyof typeof qualityOrder] || 1;
      const allowed = qualityOrder[planQuality as keyof typeof qualityOrder] || 1;
      return requested <= allowed;
    };

    // Count generations used today
    const usedToday = await GenerationService.countGenerationsToday(user.id);
    const hasFreeGenerations = usedToday < limits.dailyGenerations;
    const isQualityAllowed = qualityAllowed(qualityValue, limits.quality);

    // Determine if we should use free generation or tokens
    // For Infinity (Premium), always use free generation if quality is allowed
    // For limited plans, use free generation if within daily limit and quality is allowed
    const useFreeGeneration = hasFreeGenerations && isQualityAllowed;

    logger.logApiInfo('Generation options determined', {
      userId: user.id.substring(0, 8) + '...',
      useFreeGeneration,
      tokenCost,
      plan,
      usedToday,
      remainingGenerations: limits.dailyGenerations - usedToday,
      quality: qualityValue
    });

    // If not using free generation, check token balance
    if (!useFreeGeneration) {
      const tokensInfo = await TokenService.getTokenInfo(user.id);
      if (tokensInfo.balance < tokenCost) {
        return response.status(402).json(
          errorResponse(`Недостаточно токенов. Требуется ${tokenCost}, доступно ${tokensInfo.balance}`, 402, undefined, requestOrigin)
        );
      }
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, 'generation', 10, 60000, ipAddress, authenticatedUser.authType);
    if (!rateLimit.allowed) {
      return response.status(429).json(
        rateLimitResponse(Math.ceil((rateLimit.resetTime - Date.now()) / 1000), requestOrigin)
      );
    }

    // Record usage IMMEDIATELY to prevent race conditions
    await recordUsage(user.id, 'generation', ipAddress);

    // Spend tokens BEFORE generation (to prevent abuse) - only if not using free generation
    let spendResult: { success: boolean; newBalance: number } | null = null;
    if (!useFreeGeneration) {
      spendResult = await TokenService.spendTokens(
        user.id,
        tokenCost,
        `Generation: ${qualityValue} quality`
      );

      if (!spendResult || !spendResult.success) {
        return response.status(402).json(
          errorResponse('Недостаточно токенов для генерации', 402, undefined, requestOrigin)
        );
      }
    }

    // Prepare images using service
    const selectedImages = GenerationService.prepareImages(userImages);
    const imageParts = GenerationService.convertImagesToParts(selectedImages, config.referenceImage);

    // Build prompt using service
    let promptData;
    try {
      promptData = GenerationService.buildGenerationPrompt(config, selectedImages.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Неверный тип стиля')) {
        return response.status(400).json(
          errorResponse('Неверный тип стиля', 400, undefined, requestOrigin)
        );
      }
      throw error;
    }
    
    const { systemInstruction, finalPrompt } = promptData;

    // Create generation record with 'processing' status
    let generationId: string | null = null;
    try {
      const generationResult = await sql<{ id: string }>`
        INSERT INTO generations (user_id, status, prompt_used, trend, quality)
        VALUES (${user.id}, 'processing', ${finalPrompt.substring(0, 1000)}, ${config.trend || null}, ${config.quality || '1K'})
        RETURNING id
      `;
      generationId = generationResult.rows[0]?.id || null;
    } catch (error) {
      logger.logApiError('createGenerationRecord', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id?.substring(0, 8) + '...',
      });
      
      // If we failed to create the record, we should refund tokens and stop
      if (!useFreeGeneration) {
        await TokenService.addTokens(user.id, tokenCost, 'refund', 'Refund: Database error during initialization');
      }
      
      return response.status(500).json(
        errorResponse('Ошибка базы данных. Попробуйте позже.', 500, undefined, requestOrigin)
      );
    }

    try {
      // Use tryWithFallback to automatically switch to backup key on retryable errors
      const geminiResponse = await tryWithFallback(
        async (apiKey: string) => {
          const ai = new GoogleGenAI({ apiKey });
          return await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
              parts: [
                ...imageParts,
                { text: finalPrompt }
              ]
            },
            config: {
              imageConfig: {
                // Map aspect ratio: Gemini accepts both '3:4' format and 'PORTRAIT' enum
                // We pass the value as-is since Gemini API supports both formats
                aspectRatio: config.ratio || '3:4',
                imageSize: config.quality || '1K',
              },
              ...(systemInstruction ? { systemInstruction } : {}),
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
              ] as SafetySetting[]
            }
          });
        },
        {
          operation: 'generateImage',
          imageCount: selectedImages.length,
          hasReference: !!config.referenceImage,
          trend: config.trend,
          quality: config.quality,
          userId: user.id?.substring(0, 8) + '...',
        }
      );

      // Extract image
      let generatedImageBase64: string | null = null;
      for (const part of geminiResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          generatedImageBase64 = part.inlineData.data || null;
          break;
        }
      }

      if (!generatedImageBase64) {
        const errorMsg = geminiResponse.candidates?.[0]?.finishReason === 'SAFETY' 
          ? 'Нейросеть посчитала запрос небезопасным (Safety Filter). Попробуйте выбрать другой стиль или фото.'
          : 'Не удалось сгенерировать изображение. Токены возвращены.';
        
        // Update generation record with failed status
        if (generationId) {
          try {
            await sql`
              UPDATE generations 
              SET status = 'failed', 
                  error_message = ${errorMsg},
                  updated_at = NOW()
              WHERE id = ${generationId}
            `;
          } catch (error) {
            logger.logApiError('updateGenerationFailed', error instanceof Error ? error : new Error(String(error)));
          }
        }
        
        // Refund tokens only if they were spent (not free generation)
        if (!useFreeGeneration) {
          await TokenService.addTokens(user.id, tokenCost, 'refund', 
            geminiResponse.candidates?.[0]?.finishReason === 'SAFETY' 
              ? 'Refund: Safety filter' 
              : 'Refund: Generation failed'
          );
        }
        
        return response.status(
          geminiResponse.candidates?.[0]?.finishReason === 'SAFETY' ? 400 : 500
        ).json(
          errorResponse(errorMsg, 
            geminiResponse.candidates?.[0]?.finishReason === 'SAFETY' ? 400 : 500, 
            undefined, 
            requestOrigin
          )
        );
      }

      // Return generated image as data URL
      const imageDataUrl = `data:image/png;base64,${generatedImageBase64}`;

      // Update generation record with completed status
      if (generationId) {
        try {
          await sql`
            UPDATE generations 
            SET status = 'completed', 
                image_url = ${imageDataUrl},
                updated_at = NOW()
            WHERE id = ${generationId}
          `;
        } catch (error) {
          logger.logApiError('updateGenerationCompleted', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Get current token balance for response
      const currentTokensInfo = await TokenService.getTokenInfo(user.id);
      
      return response.status(200).json(
        successResponse({
          imageUrl: imageDataUrl,
          generationId: generationId,
          tokens: {
            spent: useFreeGeneration ? 0 : tokenCost,
            remaining: currentTokensInfo.balance,
          },
        }, undefined, requestOrigin)
      );
    } catch (error: unknown) {
      // Update generation record with failed status
      if (generationId) {
        try {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await sql`
            UPDATE generations 
            SET status = 'failed', 
                error_message = ${errorMessage.substring(0, 500)},
                updated_at = NOW()
            WHERE id = ${generationId}
          `;
        } catch (updateError: unknown) {
          logger.logApiError('updateGenerationError', updateError instanceof Error ? updateError : new Error(String(updateError)));
        }
      }
      
      // Refund tokens on error only if they were spent (not free generation)
      if (!useFreeGeneration) {
        await TokenService.addTokens(user.id, tokenCost, 'refund', 'Refund: API error');
      }
      
      logger.logApiError('generateImage', error instanceof Error ? error : new Error(String(error)), {
        imageCount: selectedImages.length,
        hasReference: !!config.referenceImage,
        trend: config.trend,
        quality: config.quality,
        userId: user.id?.substring(0, 8) + '...',
        generationId: generationId,
      });

      // User-friendly error mapping
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        return response.status(429).json(
          errorResponse('Слишком много запросов. Подождите минуту и попробуйте снова.', 429, undefined, requestOrigin)
        );
      }
      if (errorMessage.includes('413')) {
        return response.status(413).json(
          errorResponse('Файлы слишком большие. Попробуйте загрузить меньше фото.', 413, undefined, requestOrigin)
        );
      }
      if (errorMessage.includes('SAFETY')) {
        return response.status(400).json(
          errorResponse('Сработал фильтр безопасности. Попробуйте сменить стиль или фото.', 400, undefined, requestOrigin)
        );
      }

      return response.status(500).json(
        errorResponse('Ошибка при генерации изображения. Попробуйте еще раз.', 500, undefined, requestOrigin)
      );
    }
  } catch (error) {
    const requestOrigin = (request.headers.origin || request.headers.referer) as string | undefined;
    logger.logApiError('generateImage', error instanceof Error ? error : new Error(String(error)));
    return response.status(500).json(
      errorResponse('Internal server error', 500, undefined, requestOrigin)
    );
  }
}

