import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useWizard } from '@/context/WizardContext';
import { useTokens } from '@/context/TokenContext';
import { useToast } from '@/context/ToastContext';
import { sanitizePrompt } from '@/utils/validation';
import { rateLimiter } from '@/utils/rateLimit';
import { logger } from '@/utils/logger';
import { trackConversion } from '@/lib/analytics';
import { uploadToCDN } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { useApiRequest } from '@/lib/api';
import { GeneratedResult, GeneratedImage, UserImage } from '@/types';
import { getBatchTokenCost } from '@/shared/constants';
import { useTelegramMainButton, useTelegramHaptics } from '@/hooks/useTelegram';
import { isTelegramWebApp } from '@/lib/telegram';
import { useImageWorker } from '@/hooks/useImageWorker';


// Move constants outside component to prevent recreation on every render
const QUICK_EDITS = [
  "✨ Больше реализма",   // Fix plastic skin
  "😊 Легкая улыбка",    // Fix serious face
  "💇‍♀️ Поправь прическу", // Fix AI hair artifacts
  "🏙 Другой фон",       // Change scenery
  "💡 Киношный свет",    // Add drama
  "🎨 Ч/Б портрет"       // stylistic save
];

const LOADING_MESSAGES = [
  "Настройка освещения...",
  "Подбор композиции кадра...",
  "Обработка деталей лица...",
  "Финальная цветокоррекция...",
  "Рендеринг в высоком разрешении..."
];

export const GenerationStep: React.FC = () => {
  const { userImages, config, result, setResult, resetWizard, setStep, hasStartedGeneration, setHasStartedGeneration } = useWizard();
  const { tokens, refresh, canGenerate } = useTokens();
  const { showToast } = useToast();
  const apiRequest = useApiRequest();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Подготовка студии...");
  const [shareSuccess, setShareSuccess] = useState(false);
  const [refinementInput, setRefinementInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [remainingRequests, setRemainingRequests] = useState(rateLimiter.getRemainingRequests());
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lastUsedImages, setLastUsedImages] = useState<UserImage[]>([]);
  
  const refinementRef = useRef<HTMLDivElement>(null);
  const isTelegram = isTelegramWebApp();
  const { show: showMainButton, hide: hideMainButton, setLoading: setMainButtonLoading } = useTelegramMainButton();
  const { impactOccurred, notificationOccurred } = useTelegramHaptics();
  const { resizeImage: resizeImageWorker, isAvailable: isWorkerAvailable } = useImageWorker();

  // Log userImages when component mounts or userImages change
  useEffect(() => {
    // Debug info removed for production
  }, [userImages]);
  
  // Update remaining requests display
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingRequests(rateLimiter.getRemainingRequests());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let msgInterval: NodeJS.Timeout | null = null;
    if (loading) {
        let i = 0;
        setLoadingMsg(LOADING_MESSAGES[0]);
        msgInterval = setInterval(() => {
            i++;
            setLoadingMsg(LOADING_MESSAGES[i % LOADING_MESSAGES.length]);
        }, 3000);
    }
    return () => {
      if (msgInterval) clearInterval(msgInterval);
    };
  }, [loading]);

  // Poll generation status until completed or failed
  const pollGenerationStatus = useCallback(async (generationId: string) => {
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
    const pollInterval = 2000; // 2 seconds
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setError('Генерация занимает слишком много времени. Попробуйте еще раз.');
        setLoading(false);
        return;
      }

      attempts++;
      
      try {
        const statusResponse = await apiRequest(`/api/generate/status?id=${generationId}`);
        
        if (!statusResponse.ok) {
          throw new Error(`Ошибка проверки статуса: ${statusResponse.status}`);
        }

        const responseData = await statusResponse.json();
        const statusData = responseData.data;
        const status = statusData?.status;
        const imageUrl = statusData?.imageUrl;
        const errorMessage = statusData?.errorMessage;

        if (status === 'completed' && imageUrl) {
          // Generation completed successfully
          setLoadingMsg("Финальная обработка...");
          
          // Upload to CDN if configured
          const finalImageUrl = await uploadToCDN(imageUrl, `generation-${Date.now()}.png`);
          
          const newResult: GeneratedResult = {
            id: generationId,
            timestamp: Date.now(),
            images: [{ imageUrl: finalImageUrl, status: 'success' }],
            imageUrl: finalImageUrl,
            promptUsed: config.trend,
            trend: config.trend
          };
          
          setResult(newResult);
          setSelectedImageIndex(0);
          
          // Track analytics
          trackConversion.generateImage('token');
          
          // Refresh token balance after generation
          await refresh();
          
          setRefinementInput("");
          setLoading(false);
          return;
        } else if (status === 'failed') {
          // Generation failed
          setError(errorMessage || 'Генерация не удалась. Попробуйте еще раз.');
          setLoading(false);
          return;
        } else {
          // Still processing, continue polling
          setTimeout(poll, pollInterval);
        }
      } catch (err: unknown) {
        console.error('Error polling generation status:', err);
        // Continue polling on error (might be temporary network issue)
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setError('Не удалось проверить статус генерации. Попробуйте еще раз.');
          setLoading(false);
        }
      }
    };

    // Start polling
    await poll();
  }, [apiRequest, config.trend, setResult, refresh]);

  const handleGenerate = useCallback(async (refinement?: string) => {
    console.log('[GenerationStep] handleGenerate started', { refinement });
    
    // Determine token cost based on quality and image count
    const quality = config.quality || '1K';
    const imageCount = config.imageCount || 1;
    const tokenCost = getBatchTokenCost(quality, imageCount);
    
    console.log('[GenerationStep] Config:', { quality, imageCount, tokenCost });

    // Определяем требуемое число людей (для пары показываем двоих, если фото ≥2)
    const inferredPeople = config.trend === TrendType.COUPLE
      ? ((userImages.length || lastUsedImages.length) >= 2 ? 2 : 1)
      : (config.numberOfPeople || 1);
    const sourceImages = userImages.length > 0 ? userImages : lastUsedImages;
    
    console.log('[GenerationStep] inferredPeople:', inferredPeople, 'sourceImages count:', sourceImages.length);

    // Check if generation is possible (either free or with tokens)
    if (!canGenerate(quality)) {
      console.log('[GenerationStep] Cannot generate - insufficient tokens');
      const currentBalance: number = tokens?.balance ?? 0;
      setError(`Недостаточно токенов. Требуется ${tokenCost} токенов для генерации ${imageCount} изображений в ${quality} качестве. Доступно: ${currentBalance}. Купите токены на странице тарифов.`);
      return;
    }

    // Check rate limit before making request
    const rateLimitCheck = rateLimiter.canMakeRequest();
    if (!rateLimitCheck.allowed) {
      console.log('[GenerationStep] Rate limit blocked:', rateLimitCheck.reason);
      setRateLimitError(rateLimitCheck.reason || 'Превышен лимит запросов');
      setTimeout(() => setRateLimitError(null), 5000);
      return;
    }

    setLoading(true);
    setHasStartedGeneration(true);
    setError(null);
    setRateLimitError(null);
    setLoadingMsg("Подготовка студии...");

    // Yield to main thread to allow UI to update loading state
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      console.log('[GenerationStep] Recording request and preparing images...');
      // Record the request
      rateLimiter.recordRequest();
      setRemainingRequests(rateLimiter.getRemainingRequests());

      // Prepare images as base64
      setLoadingMsg("Подготовка изображений...");
      console.log('[GenerationStep] Worker available:', isWorkerAvailable);
      
      const sortedImages = [...sourceImages].sort((a, b) => b.qualityScore - a.qualityScore);
      let selectedImages = sortedImages.filter(img => img.qualityScore > 40).slice(0, 5);
      if (selectedImages.length < 3) {
        selectedImages = sortedImages.slice(0, 3);
      }
      
      console.log('[GenerationStep] Selected images for processing:', selectedImages.length);

      if (selectedImages.length === 0) {
        setError('Нет подходящих изображений для генерации. Загрузите фото заново.');
        setLoading(false);
        return;
      }

      // Process images with error handling
      const resizeImageFn = isWorkerAvailable 
        ? resizeImageWorker 
        : async (file: File, maxDimension: number = 1024) => {
            console.log('[GenerationStep] Using fallback resize (non-worker)');
            const { resizeImage } = await import('@/utils/helpers');
            return resizeImage(file, maxDimension);
          };

      console.log('[GenerationStep] Starting image processing batch...');
      const preparedImages = await Promise.all(
        selectedImages.map(async (img, idx) => {
          try {
            console.log(`[GenerationStep] Processing image ${idx + 1}/${selectedImages.length}, size: ${img.file.size} bytes`);
            const base64 = await resizeImageFn(img.file, 1024);
            if (!base64) {
              console.warn(`[GenerationStep] Image ${idx + 1} processing returned empty result`);
              return null;
            }
            console.log(`[GenerationStep] Image ${idx + 1} processed successfully`);
            return {
              base64: `data:image/jpeg;base64,${base64}`,
              qualityScore: img.qualityScore,
            };
          } catch (err) {
            console.error(`[GenerationStep] Failed to process image ${idx + 1}:`, err);
            return null;
          }
        })
      );

      // Filter out failed images
      const validPreparedImages = preparedImages.filter((img): img is NonNullable<typeof img> => img !== null);
      console.log('[GenerationStep] Valid prepared images:', validPreparedImages.length);
      
      if (validPreparedImages.length < 3) {
        setError(`Недостаточно изображений после обработки. Загрузите минимум 3 фото.`);
        setLoading(false);
        return;
      }

      // Сохраняем набор использованных изображений, чтобы регенерация не теряла лица
      setLastUsedImages(selectedImages);

      // Prepare reference image if exists
      let referenceImageBase64: { base64: string; mimeType?: string } | undefined;
      if (config.referenceImage) {
        console.log('[GenerationStep] Processing reference image...');
        setLoadingMsg("Обработка референса...");
        const refBase64 = await resizeImageFn(config.referenceImage, 1024);
        if (refBase64) {
          referenceImageBase64 = {
            base64: `data:image/jpeg;base64,${refBase64}`,
            mimeType: 'image/jpeg',
          };
          console.log('[GenerationStep] Reference image processed');
        } else {
          console.warn('[GenerationStep] Reference image processing failed');
        }
      }

      // Call server API for generation
      console.log('[GenerationStep] Sending request to /api/generate/image...');
      setLoadingMsg("Генерация изображения...");
      
      const response = await apiRequest('/api/generate/image', {
        method: 'POST',
        body: JSON.stringify({
          userImages: validPreparedImages,
          config: {
            ...config,
            refinementText: refinement || config.refinementText,
            referenceImage: referenceImageBase64,
            numberOfPeople: inferredPeople,
          },
        }),
      });

      console.log('[GenerationStep] API response received, status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[GenerationStep] API Error:', errorData);
        throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
      }

      const responseData = await response.json();
      const data = responseData.data;
      const generationId = data?.generationId;
      const imageUrl = data?.imageUrl;
      const images = data?.images as Array<{ imageUrl: string; status: 'success' | 'failed'; error?: string }> | undefined;

      console.log('[GenerationStep] Response data summary:', { generationId, hasImageUrl: !!imageUrl, imagesCount: images?.length });

      // If we got generationId but no imageUrl, start polling
      if (generationId && !imageUrl && !images) {
        console.log('[GenerationStep] Starting polling for generation status...');
        setLoadingMsg("Ожидание завершения генерации...");
        await pollGenerationStatus(generationId);
        return;
      }

      // Process multiple images if available
      if (images && images.length > 0) {
        console.log('[GenerationStep] Processing multiple image results...');
        setLoadingMsg("Обработка результатов...");
        
        // Upload successful images to CDN
        const processedImages: GeneratedImage[] = await Promise.all(
          images.map(async (img, idx) => {
            if (img.status === 'success' && img.imageUrl) {
              try {
                console.log(`[GenerationStep] Uploading image ${idx + 1} to CDN...`);
                const cdnUrl = await uploadToCDN(img.imageUrl, `generation-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
                return { imageUrl: cdnUrl, status: 'success' as const };
              } catch (e) {
                console.warn(`[GenerationStep] CDN upload failed for image ${idx + 1}, using original URL`, e);
                return { imageUrl: img.imageUrl, status: 'success' as const };
              }
            }
            return { imageUrl: '', status: 'failed' as const, error: img.error };
          })
        );

        const successfulImages = processedImages.filter(img => img.status === 'success');
        console.log('[GenerationStep] Successful processed images:', successfulImages.length);
        
        if (successfulImages.length === 0) {
          throw new Error('Не удалось сгенерировать ни одного изображения');
        }

        const newResult: GeneratedResult = {
          id: generationId || Date.now().toString(),
          timestamp: Date.now(),
          images: processedImages,
          imageUrl: successfulImages[0]?.imageUrl,
          promptUsed: config.trend,
          trend: config.trend
        };
        
        setResult(newResult);
        setSelectedImageIndex(0);
      } else {
        // Legacy single image response
        if (!imageUrl) {
          console.error('[GenerationStep] No image URL in response');
          throw new Error('Сервер не вернул изображение');
        }

        console.log('[GenerationStep] Uploading single image to CDN...');
        // Upload to CDN if configured
        const finalImageUrl = await uploadToCDN(imageUrl, `generation-${Date.now()}.png`);
        
        const newResult: GeneratedResult = {
          id: generationId || Date.now().toString(),
          timestamp: Date.now(),
          images: [{ imageUrl: finalImageUrl, status: 'success' }],
          imageUrl: finalImageUrl,
          promptUsed: config.trend,
          trend: config.trend
        };
        
        setResult(newResult);
        setSelectedImageIndex(0);
      }
      
      console.log('[GenerationStep] Generation complete, refreshing state...');
      // Track analytics
      trackConversion.generateImage('token');
      
      // Refresh token balance after generation
      await refresh();
      
      setRefinementInput(""); 
      setLoading(false);

    } catch (err: unknown) {
      console.error('[GenerationStep] CRITICAL ERROR during generation:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      logger.logApiError('handleGenerate', error, {
        hasRefinement: !!refinement,
        trend: config.trend,
      });
      setError(error.message || "Произошла ошибка при генерации. Попробуйте еще раз.");
      setLoading(false);
    }
  }, [config, userImages, tokens, refresh, apiRequest, isWorkerAvailable, resizeImageWorker, pollGenerationStatus, setResult, canGenerate]);

  useEffect(() => {
    // Reset hasStartedGeneration on mount if we don't have a result yet,
    // to ensure auto-generation can trigger if we just switched back to this tab
    if (!result) {
      setHasStartedGeneration(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    // DEBUG: Auto-generate conditions check
    console.log('[GenerationStep] Auto-generate check:', {
      hasResult: !!result,
      isLoading: loading,
      hasError: !!error,
      hasStarted: hasStartedGeneration,
      imagesCount: userImages.length,
      lastUsedCount: lastUsedImages.length
    });

    // Only generate if we don't have a result yet and aren't loading
    if (!result && !loading && !error && !hasStartedGeneration) {
      console.log('[GenerationStep] Conditions met - starting handleGenerate');
      handleGenerate().catch((err: unknown) => {
        if (!cancelled) {
          console.error('Error in auto-generate:', err);
        }
      });
    }
    
    return () => {
      cancelled = true;
    };
  }, [result, loading, error, hasStartedGeneration, handleGenerate]);

  const handleSubmitRefinement = (e: React.FormEvent) => {
      e.preventDefault();
      if (!refinementInput.trim()) return;
      const sanitized = sanitizePrompt(refinementInput);
      if (!sanitized) {
        showToast('Пожалуйста, введите корректный запрос на изменение.', 'error');
        return;
      }
      handleGenerate(sanitized);
  };

  const handleQuickEdit = (text: string) => {
      // Strip emoji for the actual prompt to keep it clean
      const cleanText = text.replace(/^[^\w\u0400-\u04FF]+/, '').trim(); 
      handleGenerate(cleanText);
  };

  // Get the currently selected image URL
  const getSelectedImageUrl = useCallback((): string => {
    if (!result) return '';
    if (result.images && result.images.length > 0) {
      const successfulImages = result.images.filter(img => img.status === 'success');
      const safeIndex = Math.min(selectedImageIndex, successfulImages.length - 1);
      return successfulImages[safeIndex]?.imageUrl || result.imageUrl || '';
    }
    return result.imageUrl || '';
  }, [result, selectedImageIndex]);

  const handleShare = async () => {
      if (result) {
          try {
            const imageUrlToShare = getSelectedImageUrl();
            if (navigator.share) {
                const response = await fetch(imageUrlToShare);
                if (!response.ok) {
                  throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();
                const file = new File([blob], 'dreamlens-ai.png', { type: 'image/png' });
                
                await navigator.share({
                    title: 'Мой новый образ от DreamLens AI ✨',
                    text: 'Смотри, как нейросеть увидела меня! Сделай свой: ',
                    files: [file]
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setShareSuccess(true);
                setTimeout(() => setShareSuccess(false), 3000);
            }
          } catch (e) {
              logger.error('Error sharing image', e instanceof Error ? e : new Error(String(e)));
          }
      }
  };

  // Надёжное скачивание изображений (поддержка CDN и data URL)
  const handleDownload = useCallback(async () => {
    const currentImageUrl = getSelectedImageUrl();
    if (!currentImageUrl) return;

    try {
      const response = await fetch(currentImageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dreamlens-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback для base64 / data URL
      const link = document.createElement('a');
      link.href = currentImageUrl;
      link.download = `dreamlens-${Date.now()}.png`;
      link.click();
    }
  }, [getSelectedImageUrl]);

  // Setup MainButton for loading state
  useEffect(() => {
    if (!isTelegram) return;

    if (loading) {
      showMainButton('Генерация...', () => {}, false);
      setMainButtonLoading(true);
    } else {
      setMainButtonLoading(false);
    }

    return () => {
      if (loading) {
        hideMainButton();
        setMainButtonLoading(false);
      }
    };
  }, [loading, isTelegram, showMainButton, hideMainButton, setMainButtonLoading]);

  // Setup MainButton for error state
  useEffect(() => {
    if (!isTelegram || !error) return;

    notificationOccurred('error');
    const handleRetry = () => {
      impactOccurred('medium');
      handleGenerate();
    };
    showMainButton('Попробовать снова', handleRetry, true);

    return () => {
      hideMainButton();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isTelegram, showMainButton, hideMainButton, impactOccurred, notificationOccurred]);

  // Setup MainButton for success state
  useEffect(() => {
    if (!isTelegram || !result || loading) return;

    const handleShareDownload = async () => {
      impactOccurred('medium');
      try {
        await handleShare();
      } catch (error) {
        // Fallback to download if share fails
        const link = document.createElement('a');
        link.href = getSelectedImageUrl();
        link.download = `dreamlens-${Date.now()}.png`;
        link.click();
      }
    };

    showMainButton('Поделиться', handleShareDownload, true);

    return () => {
      hideMainButton();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, loading, isTelegram, showMainButton, hideMainButton, impactOccurred]);

  // Trigger haptic feedback on success
  useEffect(() => {
    if (!isTelegram || !result || loading) return;
    notificationOccurred('success');
  }, [result, loading, isTelegram, notificationOccurred]);

  const renderLoader = () => (
    <div className={`flex flex-col items-center justify-center ${isTelegram ? 'min-h-[70vh]' : 'min-h-[60vh]'} animate-fade-in text-center px-4`}>
      <div className={`relative ${isTelegram ? 'w-40 h-40 mb-6' : 'w-56 h-56 mb-10'}`}>
          <div className="absolute inset-0 border-4 border-brand-200/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin shadow-glow-md"></div>
          <div className="absolute inset-0 flex items-center justify-center">
               <span className={`${isTelegram ? 'text-4xl' : 'text-5xl'} animate-breathe filter drop-shadow-2xl`}>📸</span>
          </div>
      </div>
      <h3 
        className={`${isTelegram ? 'text-xl' : 'text-3xl'} font-serif font-bold mb-3 text-shadow-soft animate-pulse`}
        style={{ color: isTelegram ? 'var(--tg-theme-text-color, #000000)' : '#1f2937' }}
      >
          {loadingMsg}
      </h3>
      {!isTelegram && (
        <p className="text-gray-400 text-sm animate-pulse">Не закрывайте вкладку... Это может занять до минуты</p>
      )}
      {!isTelegram && (
        <div className="mt-8 w-full max-w-md">
          <div className="aspect-square rounded-2xl skeleton bg-gradient-to-br from-gray-100 to-gray-200"></div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return renderLoader();
  }

  // Если результата ещё нет, но загрузка завершена/не стартовала — показываем лоадер для защиты от пустого экрана
  if (!result) {
    return renderLoader();
  }

  if (error) {
    return (
      <div className={`text-center ${isTelegram ? 'py-10' : 'py-20'} animate-fade-in px-4`}>
        {/* Back button for web - positioned at top left */}
        {!isTelegram && (
          <div className="text-left mb-6">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 text-gray-500 hover:text-brand-600 transition-colors group"
            >
              <svg 
                className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Назад к настройкам</span>
            </button>
          </div>
        )}
        
        <div className={`${isTelegram ? 'w-20 h-20 mb-4' : 'w-28 h-28 mb-6'} glass-sm bg-red-50/50 rounded-full flex items-center justify-center mx-auto shadow-premium`}>
            <span className={`${isTelegram ? 'text-4xl' : 'text-6xl'} animate-breathe`}>💔</span>
        </div>
        <h3 
          className={`${isTelegram ? 'text-2xl' : 'text-4xl'} font-serif font-bold mb-3 text-shadow-soft`}
          style={{ color: isTelegram ? 'var(--tg-theme-text-color, #000000)' : '#1f2937' }}
        >
          Упс, что-то пошло не так
        </h3>
        <p 
          className="mb-8 max-w-md mx-auto leading-relaxed"
          style={{ color: isTelegram ? 'var(--tg-theme-hint-color, #999999)' : '#6b7280' }}
        >
          {error}
        </p>
        {!isTelegram && (
          <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="secondary" onClick={() => setStep(3)}>Изменить настройки</Button>
              <Button onClick={() => handleGenerate()} className="shadow-glow-lg">Попробовать снова</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`animate-fade-in-up text-center ${isTelegram ? 'max-w-full' : 'max-w-5xl'} mx-auto ${isTelegram ? 'pb-4' : 'pb-10'}`}>
      {/* Back button for web - positioned at top left */}
      {!isTelegram && (
        <div className="text-left mb-6">
          <button
            onClick={() => setStep(3)}
            className="flex items-center gap-2 text-gray-500 hover:text-brand-600 transition-colors group"
          >
            <svg 
              className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Назад к настройкам</span>
          </button>
        </div>
      )}
      
      {!isTelegram && (
        <div className="mb-10">
            <h2 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 mb-4 text-gradient bg-clip-text text-transparent text-shadow-premium">Ваш образ готов</h2>
            <p className="text-gray-500 font-medium text-lg">
               Стиль: <span className="text-brand-600 font-bold text-shadow-soft">{config.trend}</span>
            </p>
        </div>
      )}
      
      {/* Image Gallery */}
      {(() => {
        const successfulImages = result?.images?.filter(img => img.status === 'success') || [];
        const hasMultipleImages = successfulImages.length > 1;
        
        return (
          <>
            {/* Premium Main Result Card */}
            <div className={`relative inline-block group w-full ${isTelegram ? 'max-w-full' : 'max-w-2xl'} mx-auto select-none`}>
                {!isTelegram && (
                  <div className="absolute -inset-2 bg-gradient-premium rounded-[2.5rem] blur-xl opacity-40 group-hover:opacity-60 transition duration-700 animate-glow"></div>
                )}
                
                <div className={`relative ${isTelegram ? 'rounded-xl p-2' : 'glass-lg rounded-[2rem] p-4'} shadow-premium overflow-hidden ${isTelegram ? '' : 'border border-white/30'}`}>
                  {/* Image Container */}
                  <div className={`relative ${isTelegram ? 'rounded-lg' : 'rounded-[1.5rem]'} overflow-hidden ${isTelegram ? '' : 'glass-sm'} flex justify-center items-center ${isTelegram ? 'min-h-[50vh]' : 'min-h-[300px]'}`}>
                      {/* Skeleton loader while image loads */}
                      <div className="absolute inset-0 skeleton bg-gradient-to-br from-gray-100 to-gray-200"></div>
                      <img 
                          src={currentImageUrl} 
                          alt="Result" 
                          className={`relative max-w-full ${isTelegram ? 'max-h-[70vh]' : 'max-h-[75vh]'} w-auto h-auto object-contain shadow-soft-lg transition-all duration-200 z-10`}
                          onLoad={(e) => {
                              const skeleton = e.currentTarget.previousElementSibling as HTMLElement;
                              if (skeleton) skeleton.style.display = 'none';
                          }}
                      />

                      {/* Premium Download Button - for all platforms */}
                      <div className={`absolute ${isTelegram ? 'top-2 right-2' : 'top-4 right-4'} flex gap-2 z-20`}>
                        <button 
                          onClick={() => {
                            handleDownload();
                          }}
                          className={`${isTelegram ? 'bg-white/80 p-2.5' : 'glass-md bg-white/90 p-3.5'} backdrop-blur-md text-gray-800 rounded-full shadow-premium hover:scale-110 hover:shadow-glow-md transition-all z-20`}
                          title="Скачать в HD"
                        >
                          <svg className={`${isTelegram ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                      </div>

                      {/* Image counter badge */}
                      {hasMultipleImages && (
                        <div className={`absolute ${isTelegram ? 'top-2 left-2' : 'top-4 left-4'} z-20`}>
                          <span className={`${isTelegram ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-black/60 text-white rounded-full font-medium backdrop-blur-md`}>
                            {selectedImageIndex + 1} / {successfulImages.length}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
            </div>

            {/* Thumbnail Gallery - only show if multiple images */}
            {hasMultipleImages && (
              <div className={`${isTelegram ? 'mt-3 px-2' : 'mt-6'} max-w-2xl mx-auto`}>
                <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
                  {successfulImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        impactOccurred('light');
                        setSelectedImageIndex(index);
                      }}
                      className={`
                        relative rounded-lg sm:rounded-xl overflow-hidden transition-all duration-200
                        ${isTelegram ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-20 h-20 sm:w-24 sm:h-24'}
                        ${selectedImageIndex === index 
                          ? 'ring-2 sm:ring-3 ring-brand-500 ring-offset-2 scale-105 shadow-glow-md' 
                          : 'ring-1 ring-gray-200 hover:ring-brand-300 hover:scale-102 opacity-70 hover:opacity-100'
                        }
                      `}
                    >
                      <img 
                        src={img.imageUrl} 
                        alt={`Вариант ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedImageIndex === index && (
                        <div className="absolute inset-0 bg-brand-500/10 flex items-center justify-center">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p 
                  className="text-center mt-2 text-xs"
                  style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                >
                  Нажми, чтобы выбрать вариант
                </p>
              </div>
            )}
          </>
        );
      })()}

      {/* Tech Details Toggle - hidden in Telegram */}
      {!isTelegram && (
        <div className="mt-4 flex justify-center">
          <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-400 hover:text-brand-500 font-medium flex items-center gap-1 transition-colors"
          >
              {showDetails ? 'Скрыть детали' : 'Показать параметры генерации'} 
              <svg className={`w-4 h-4 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      )}

      {showDetails && (
          <div className="max-w-lg mx-auto mt-4 glass-sm rounded-xl p-4 text-left text-xs text-gray-600 font-mono animate-fade-in border border-white/20 shadow-soft">
              <p><strong>Model:</strong> gemini-3-pro-image-preview (Neural Texture Engine)</p>
              <p><strong>Aspect Ratio:</strong> {config.ratio}</p>
              <p><strong>Quality:</strong> {config.quality}</p>
              <p><strong>Trend:</strong> {config.trend}</p>
              {config.dominantColor && <p><strong>Color:</strong> {config.dominantColor}</p>}
              {config.userPrompt && <p><strong>User Prompt:</strong> {config.userPrompt}</p>}
          </div>
      )}

      {/* Premium Token Info */}
      {tokens && (
        <div className="max-w-lg mx-auto mt-4 mb-4 space-y-2">
          {/* Token balance */}
          <div className={`border rounded-xl p-4 text-center shadow-soft ${
            tokens.balance === 0
              ? 'glass-sm bg-yellow-50/50 border-yellow-200/50' 
              : 'glass-sm bg-blue-50/50 border-blue-200/50'
          }`}>
            <p className={`text-sm ${
              tokens.balance === 0 
                ? 'text-yellow-800' 
                : 'text-blue-800'
            }`}>
              {tokens.balance === 0 ? (
                <>
                  Недостаточно токенов. <a href="/pricing" className="underline font-bold hover:text-yellow-900 transition-colors">Купить токены</a>
                </>
              ) : (
                <>
                  Баланс: <strong>{tokens.balance} токенов</strong>
                  {config.quality && (
                    <span className="ml-2">
                      (стоимость: {getBatchTokenCost(config.quality, config.imageCount || 1)} токенов за {config.imageCount || 1} шт.)
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Rate Limit Info */}
      {remainingRequests < 3 && (
        <div className="max-w-lg mx-auto mt-4 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-sm text-blue-800">
              Осталось запросов в этой минуте: <strong>{remainingRequests}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Rate Limit Error */}
      {rateLimitError && (
        <div className="max-w-lg mx-auto mt-4 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
            <p className="text-sm text-yellow-800">{rateLimitError}</p>
          </div>
        </div>
      )}

      {/* REFINEMENT SECTION */}
      <div className={`${isTelegram ? 'max-w-full px-2 sm:px-4' : 'max-w-lg'} mx-auto ${isTelegram ? 'mt-4 mb-4' : 'mt-8 mb-8'} space-y-4`} ref={refinementRef}>
          {/* Quick Actions Chips */}
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {QUICK_EDITS.map((edit) => (
                <button
                    key={edit}
                    onClick={() => {
                      impactOccurred('light');
                      handleQuickEdit(edit);
                    }}
                    className={`${isTelegram ? 'px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs' : 'px-4 py-2 text-sm'} rounded-full bg-white border border-brand-100 font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 transition-all shadow-sm active:scale-95`}
                >
                    {edit}
                </button>
            ))}
          </div>

          <form onSubmit={handleSubmitRefinement} className="relative">
              <input 
                  type="text" 
                  value={refinementInput}
                  onChange={(e) => setRefinementInput(e.target.value)}
                  placeholder="Что изменить? (например: добавь шляпу...)"
                  className={`w-full ${isTelegram ? 'p-3 pr-12 rounded-xl text-sm' : 'p-4 pr-14 rounded-2xl'} border-2 border-brand-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none shadow-sm transition-all text-gray-700 bg-white`}
              />
              <button 
                type="submit"
                disabled={!refinementInput.trim()}
                onClick={() => impactOccurred('light')}
                className={`absolute ${isTelegram ? 'right-1.5 top-1.5 bottom-1.5' : 'right-2 top-2 bottom-2'} aspect-square ${isTelegram ? 'rounded-lg' : 'rounded-xl'} flex items-center justify-center transition-all ${
                    refinementInput.trim() ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-gray-100 text-gray-300'
                }`}
              >
                  <svg className={`${isTelegram ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </button>
          </form>
      </div>

      {/* Actions */}
      {!isTelegram && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Button 
              onClick={handleShare}
              className="w-full py-4 text-lg bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200 relative overflow-hidden"
          >
              {shareSuccess ? 'Ссылка скопирована! ✅' : 'Поделиться'}
          </Button>
          
          <Button onClick={() => handleGenerate()} className="w-full py-4 text-lg bg-gradient-to-r from-brand-500 to-brand-600 shadow-brand-200">
              🔄 Еще вариант
          </Button>
          
          <Button variant="secondary" onClick={() => setStep(2)} className="w-full py-4">
              Сменить стиль
          </Button>
          
          <Button variant="ghost" onClick={resetWizard} className="w-full py-4 text-sm">
              Новая фотосессия
          </Button>
        </div>
      )}

      {/* Telegram Actions - Compact */}
      {isTelegram && (
        <div className="mt-4 px-4 space-y-2">
          <Button 
            onClick={() => {
              impactOccurred('medium');
              handleGenerate();
            }} 
            className="w-full py-3 text-base bg-gradient-to-r from-brand-500 to-brand-600 shadow-brand-200"
          >
            🔄 Еще вариант
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                impactOccurred('light');
                setStep(2);
              }} 
              className="w-full py-2.5 text-sm"
            >
              Сменить стиль
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                impactOccurred('light');
                resetWizard();
              }} 
              className="w-full py-2.5 text-sm"
            >
              Новая сессия
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};