import React from 'react';
import { PricingView } from '../payments/PricingView';
import { useTelegramTheme } from '../../hooks/useTelegram';

interface TelegramPricingScreenProps {
  onBack: () => void;
}

export const TelegramPricingScreen: React.FC<TelegramPricingScreenProps> = ({ onBack }) => {
  const theme = useTelegramTheme();

  // Note: Back button handling is done in AppContent via useTelegramBackButton hook
  // This component doesn't need to manage the back button to avoid conflicts

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: theme?.bgColor || 'var(--tg-theme-bg-color, #ffffff)',
        color: theme?.textColor || 'var(--tg-theme-text-color, #000000)',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#212121]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: theme?.textColor || 'inherit' }}>
            Купить токены
          </h1>
        </div>
      </header>
      <PricingView onBack={onBack} compact={true} />
    </div>
  );
};
