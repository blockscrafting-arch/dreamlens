import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames?: string[];
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ 
  currentStep, 
  totalSteps,
}) => {
  // Simple segmented progress bar (like Instagram Stories)
  return (
    <div 
      className="w-full px-4 py-2"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        borderBottom: '1px solid var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
      }}
    >
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          
          return (
            <div
              key={stepNumber}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: isCompleted || isActive
                  ? 'var(--tg-theme-button-color, #3390ec)'
                  : 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
                opacity: isCompleted ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
