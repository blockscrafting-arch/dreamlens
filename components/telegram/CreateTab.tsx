import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { useWizard } from '../../context/WizardContext';
import { WizardProgress } from './WizardProgress';
import { isTelegramWebApp } from '../../lib/telegram';

// Lazy load wizard steps for code splitting
const UploadStep = lazy(() => import('../wizard/UploadStep').then(module => ({ default: module.UploadStep })));
const TrendStep = lazy(() => import('../wizard/TrendStep').then(module => ({ default: module.TrendStep })));
const ConfigStep = lazy(() => import('../wizard/ConfigStep').then(module => ({ default: module.ConfigStep })));
const GenerationStep = lazy(() => import('../wizard/GenerationStep').then(module => ({ default: module.GenerationStep })));

const StepLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-500">Загрузка...</p>
    </div>
  </div>
);

export const CreateTab: React.FC = () => {
  const { step, setStep, userImages, config } = useWizard();
  const [displayStep, setDisplayStep] = useState(step);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isAnimating, setIsAnimating] = useState(false);
  const prevStepRef = useRef(step);
  const isTelegram = isTelegramWebApp();

  useEffect(() => {
    if (step !== prevStepRef.current) {
      const newDirection = step > prevStepRef.current ? 'forward' : 'backward';
      setDirection(newDirection);
      setIsAnimating(true);
      
      // Scroll to top when step changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Update display step after a brief delay to allow exit animation
      const timer = setTimeout(() => {
        setDisplayStep(step);
        prevStepRef.current = step;
        // Reset animation state after animation completes
        setTimeout(() => {
          setIsAnimating(false);
        }, 300);
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      setDisplayStep(step);
    }
  }, [step]);

  const renderStep = () => {
    switch (displayStep) {
      case 1:
        return <UploadStep />;
      case 2:
        return <TrendStep />;
      case 3:
        return <ConfigStep />;
      case 4:
        return <GenerationStep />;
      default:
        return <UploadStep />;
    }
  };

  const canGoToStep = (targetStep: number) => {
    if (targetStep < step) return true;
    if (targetStep > 1 && userImages.length < 3) return false;
    if (targetStep > 2 && !config.trend) return false;
    return true;
  };

  const handleProgressClick = (targetStep: number) => {
    if (canGoToStep(targetStep)) {
      setStep(targetStep);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Progress Bar - only in Telegram */}
      {isTelegram && (
        <WizardProgress 
          currentStep={step} 
          totalSteps={4}
          onStepClick={handleProgressClick}
          canGoToStep={canGoToStep}
        />
      )}
      
      <div className={`${isTelegram ? 'px-2 sm:px-4 py-4 sm:py-6 pb-24' : 'px-4 py-6'} space-y-4 sm:space-y-6`}>
        <div 
          key={displayStep}
          className={`
            min-h-[70vh] relative transition-all duration-300 ease-out
            ${isAnimating 
              ? (direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left')
              : ''
            }
          `}
        >
          <Suspense fallback={<StepLoader />}>
            {renderStep()}
          </Suspense>
        </div>
      </div>
    </div>
  );
};
