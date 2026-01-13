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
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [pressedStep, setPressedStep] = useState<number | null>(null);

  const stepNames = ['Фото', 'Стиль', 'Детали', 'Финал'];

  return (
    <div 
      className="w-full px-4 py-3"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        borderBottom: '1px solid var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
      }}
    >
      <div className="flex gap-2 items-center">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isDisabled = canGoToStep ? !canGoToStep(stepNumber) : false;
          const isHovered = hoveredStep === stepNumber;
          const isPressed = pressedStep === stepNumber;
          
          return (
            <button
              key={stepNumber}
              type="button"
              onClick={() => {
                if (!isDisabled && onStepClick) {
                  onStepClick(stepNumber);
                }
              }}
              onMouseDown={() => !isDisabled && setPressedStep(stepNumber)}
              onMouseUp={() => setPressedStep(null)}
              onMouseEnter={() => !isDisabled && setHoveredStep(stepNumber)}
              onMouseLeave={() => {
                setHoveredStep(null);
                setPressedStep(null);
              }}
              onTouchStart={() => !isDisabled && setPressedStep(stepNumber)}
              onTouchEnd={() => setPressedStep(null)}
              disabled={isDisabled}
              aria-label={`Шаг ${stepNumber}: ${stepNames[index] || ''}`}
              className={`
                flex-1 rounded-full transition-all duration-200 relative
                touch-manipulation
                ${!isDisabled ? 'cursor-pointer' : 'cursor-not-allowed'}
              `}
              style={{
                height: isPressed ? '8px' : isHovered ? '6px' : '4px',
                backgroundColor: isCompleted || isActive
                  ? 'var(--tg-theme-button-color, #3390ec)'
                  : 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
                opacity: isDisabled ? 0.4 : isCompleted ? 0.6 : isHovered ? 0.9 : 1,
                transform: isPressed ? 'scaleY(2)' : isHovered ? 'scaleY(1.5)' : 'scaleY(1)',
                boxShadow: isActive 
                  ? '0 0 0 2px var(--tg-theme-button-color, #3390ec), 0 0 8px rgba(51, 144, 236, 0.3)'
                  : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
