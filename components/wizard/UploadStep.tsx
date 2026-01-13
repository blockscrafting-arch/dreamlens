import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { getDatasetHealth, analyzeImageQuality } from '../../utils/helpers';
import { validateFiles } from '../../utils/validation';
import { QualityMeter } from '../ui/QualityMeter';
import { PhotoUploadArea } from './PhotoUploadArea';
import { PhotoPreviewGrid } from './PhotoPreviewGrid';
import { Button } from '../ui/Button';
import { useTelegramMainButton, useTelegramHaptics } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';
import { useImageWorker } from '../../hooks/useImageWorker';

export const UploadStep: React.FC = () => {
  const { userImages, addUserImage, removeUserImage, setStep } = useWizard();
  const { showToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const isTelegram = isTelegramWebApp();
  const { show: showMainButton, hide: hideMainButton } = useTelegramMainButton();
  const { impactOccurred } = useTelegramHaptics();
  const { analyzeImage, isAvailable: isWorkerAvailable } = useImageWorker();
  
  // Cleanup ObjectURLs when component unmounts or images change
  useEffect(() => {
    return () => {
      // Revoke all ObjectURLs on unmount to prevent memory leaks
      userImages.forEach((img) => {
        if (img.previewUrl && img.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
  }, []); // Only cleanup on unmount
  
  // Cleanup when individual images are removed
  const handleRemoveImage = useCallback((index: number) => {
    const img = userImages[index];
    if (img?.previewUrl && img.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(img.previewUrl);
    }
    removeUserImage(index);
  }, [userImages, removeUserImage]);

  const processFiles = async (files: File[]) => {
      setIsProcessing(true);
      try {
        // Validate files before processing
        const validation = validateFiles(files);
        if (!validation.valid) {
          showToast(`Ошибки валидации: ${validation.errors.join(', ')}`, 'error');
          setIsProcessing(false);
          return;
        }
        
        // Filter only valid image files
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
          setIsProcessing(false);
          return;
        }

        // Fallback to main thread if worker is not available
        if (!isWorkerAvailable) {
          console.warn('Worker not available, falling back to main thread processing');
          const { analyzeImageQuality } = await import('../../utils/helpers');
          
          for (const file of imageFiles) {
            const fileId = `${file.name}-${file.size}-${file.lastModified}`;
            setProcessingFiles(prev => new Set(prev).add(fileId));
            
            try {
              const previewUrl = URL.createObjectURL(file);
              const { score, feedback } = await analyzeImageQuality(file);
              
              addUserImage({ 
                file, 
                previewUrl, 
                qualityScore: score,
                feedback
              });
            } catch (error) {
              console.error("Error processing file:", error);
            } finally {
              setProcessingFiles(prev => {
                const next = new Set(prev);
                next.delete(fileId);
                return next;
              });
            }
          }
          setIsProcessing(false);
          return;
        }
        
        // Process files in parallel using worker
        const processingPromises = imageFiles.map(async (file) => {
          const fileId = `${file.name}-${file.size}-${file.lastModified}`;
          setProcessingFiles(prev => new Set(prev).add(fileId));
          
          try {
            const previewUrl = URL.createObjectURL(file);
            // Analysis happens in worker (non-blocking)
            const { score, feedback } = await analyzeImage(file);
            
            addUserImage({ 
              file, 
              previewUrl, 
              qualityScore: score,
              feedback
            });
          } catch (error) {
            console.warn("Worker processing failed, falling back to main thread:", error);
            // Fallback to main thread processing
            try {
              const previewUrl = URL.createObjectURL(file);
              const { score, feedback } = await analyzeImageQuality(file);
              
              addUserImage({ 
                file, 
                previewUrl, 
                qualityScore: score,
                feedback
              });
            } catch (fallbackError) {
              console.error("Error processing file (both worker and fallback failed):", fallbackError);
              showToast(`Ошибка при обработке ${file.name}`, 'error');
            }
          } finally {
            setProcessingFiles(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
          }
        });
        
        await Promise.all(processingPromises);
      } catch (error) {
        console.error("Error processing files:", error);
        showToast("Произошла ошибка при обработке файлов. Попробуйте еще раз.", 'error');
      } finally {
        setIsProcessing(false);
        setProcessingFiles(new Set());
      }
  };


  // Metrics Calculation
  const { avgScore, readiness } = useMemo(() => {
      if (userImages.length === 0) return { avgScore: 0, readiness: 0 };
      const total = userImages.reduce((acc, img) => acc + img.qualityScore, 0);
      const avg = total / userImages.length;
      const ready = getDatasetHealth(userImages.length, avg);
      return { avgScore: avg, readiness: ready };
  }, [userImages]);

  // Minimum required to physically proceed. Lowered to 3 high quality ones.
  const canProceed = userImages.length >= 3 && readiness > 30;

  // Debug environment
  useEffect(() => {
    console.log('[UploadStep] Environment check:', {
      isTelegram,
      imagesCount: userImages.length,
      readiness,
      canProceed,
      isProcessing
    });
  }, [isTelegram, userImages.length, readiness, canProceed, isProcessing]);

  // Setup Telegram MainButton
  useEffect(() => {
    // Only show Telegram button if we are REALLY in Telegram mobile app
    if (!isTelegram) return;

    if (canProceed && !isProcessing) {
      showMainButton('Далее: Выбрать стиль', () => {
        impactOccurred('medium');
        setStep(2);
      }, true);
    } else {
      showMainButton(
        `Загрузи еще ${Math.max(0, 3 - userImages.length)} фото`,
        () => {
          impactOccurred('light');
          showToast('Загрузите минимум 3 качественных фото', 'error');
        },
        false
      );
    }

    return () => {
      hideMainButton();
    };
  }, [canProceed, isProcessing, userImages.length, isTelegram, showMainButton, hideMainButton, setStep, impactOccurred, showToast]);

  // Note: Telegram BackButton is managed centrally in App.tsx to avoid conflicts

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-6">
      
      {/* Simple Processing Overlay */}
      {isProcessing && (
          <div 
            className="absolute inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            }}
          >
              <div className="w-12 h-12 border-2 border-t-[var(--tg-theme-button-color,#3390ec)] rounded-full animate-spin mb-4"></div>
              <p style={{ color: 'var(--tg-theme-hint-color, #999999)' }}>
                Анализирую фото...
              </p>
          </div>
      )}

      {/* Premium Header */}
      <div className="mb-8 text-center">
        <h2 
          className="text-3xl md:text-5xl font-serif font-bold mb-4"
          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          Загрузите фото
        </h2>
        <p 
          className="text-base leading-relaxed max-w-lg mx-auto"
          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
        >
          Нам не нужно много фото. Нам нужны <b style={{ color: 'var(--tg-theme-text-color, #000000)' }}>лучшие</b>.
          <br/><span className="text-brand-600 font-medium">Загрузите 5-8 качественных селфи крупным планом.</span>
        </p>
      </div>

      {/* Модуль загрузки фото */}
      <div className="space-y-6 mb-8">
        <PhotoUploadArea
          onFilesSelected={processFiles}
          isProcessing={isProcessing}
          isDragging={isDragging}
          onDragStateChange={setIsDragging}
        />
        
        <PhotoPreviewGrid
          images={userImages}
          onRemove={handleRemoveImage}
          isProcessing={isProcessing}
          processingFiles={processingFiles}
        />
      </div>

      {/* Визуальное разделение */}
      <div 
        className="border-t-2 border-dashed my-8"
        style={{
          borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.2))',
        }}
      />

      {/* Модуль готовности модели */}
      <div className="mt-8 mb-12">
        <QualityMeter count={userImages.length} averageScore={avgScore} readiness={readiness} />
      </div>

      {/* Web Next Button (Non-Telegram) */}
      {!isTelegram && (
        <div className="flex justify-center mt-10">
          <Button
            disabled={!canProceed || isProcessing}
            onClick={() => setStep(2)}
            className="w-full max-w-md py-4 text-lg bg-gradient-to-r from-brand-500 to-brand-600 shadow-glow-md"
          >
            {canProceed 
              ? 'Далее: Выбрать стиль →' 
              : `Загрузите еще ${Math.max(0, 3 - userImages.length)} фото`}
          </Button>
        </div>
      )}
    </div>
  );
};