import React, { useEffect } from 'react';
import { DailyWheel } from './DailyWheel';

interface DailyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyWheelModal: React.FC<DailyWheelModalProps> = ({ isOpen, onClose }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      />
      
      {/* Modal Content */}
      <div 
        className="relative z-10 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-pop-in"
        style={{
          backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Закрыть"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 
            className="text-2xl font-serif font-bold mb-2"
            style={{ color: 'var(--tg-theme-text-color, #000000)' }}
          >
            Ежедневный бонус
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
          >
            Крути рулетку каждый день и получай токены!
          </p>
        </div>

        {/* Wheel */}
        <DailyWheel />
      </div>
    </div>
  );
};
