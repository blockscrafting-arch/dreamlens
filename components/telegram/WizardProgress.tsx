import React, { useState } from 'react';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames?: string[];
  onStepClick?: (step: number) => void;
  canGoToStep?: (step: number) => boolean;
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ 
  currentStep, 
  totalSteps,
  onStepClick,
  canGoToStep,
}) => {
  const [pressedStep, setPressedStep] = useState<number | null>(null);

  const stepLabels = ['Фото', 'Стиль', 'Детали', 'Готово'];

  const handleClick = (stepNumber: number, isDisabled: boolean) => {
    if (!isDisabled && onStepClick) {
      console.log('[WizardProgress] Clicking step:', stepNumber);
      onStepClick(stepNumber);
    }
  };

  return (
    <div 
      className="w-full px-3 py-3 relative z-50"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        borderBottom: '1px solid var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
      }}
    >
      <div className="flex gap-1.5 items-stretch">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isDisabled = canGoToStep ? !canGoToStep(stepNumber) : true;
          const isPressed = pressedStep === stepNumber;
          
          return (
            <button
              key={stepNumber}
              type="button"
              onClick={() => handleClick(stepNumber, isDisabled)}
              onTouchStart={() => {
                if (!isDisabled) {
                  setPressedStep(stepNumber);
                }
              }}
              onTouchEnd={() => {
                setPressedStep(null);
              }}
              onMouseDown={() => !isDisabled && setPressedStep(stepNumber)}
              onMouseUp={() => setPressedStep(null)}
              onMouseLeave={() => setPressedStep(null)}
              disabled={isDisabled}
              aria-label={`Шаг ${stepNumber}: ${stepLabels[index] || ''}`}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all duration-150
                touch-manipulation select-none
                ${!isDisabled ? 'cursor-pointer active:bg-black/5' : 'cursor-not-allowed opacity-40'}
                ${isPressed ? 'scale-95 bg-black/5' : ''}
              `}
            >
              {/* Progress bar segment */}
              <div 
                className={`
                  w-full h-1.5 rounded-full transition-all duration-200
                  ${isActive ? 'ring-2 ring-offset-1' : ''}
                `}
                style={{
                  backgroundColor: isCompleted || isActive
                    ? 'var(--tg-theme-button-color, #3390ec)'
                    : 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.15))',
                  ringColor: isActive ? 'var(--tg-theme-button-color, #3390ec)' : 'transparent',
                }}
              />
              {/* Step label */}
              <span 
                className={`text-[10px] font-medium transition-colors duration-150`}
                style={{
                  color: isCompleted || isActive
                    ? 'var(--tg-theme-button-color, #3390ec)'
                    : 'var(--tg-theme-hint-color, #999999)',
                }}
              >
                {stepLabels[index]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
