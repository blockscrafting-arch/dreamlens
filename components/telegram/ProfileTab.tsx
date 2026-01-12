import React from 'react';
import { TokenBalance } from '../tokens/TokenBalance';
import { DailyWheel } from '../tokens/DailyWheel';
import { useTokens } from '../../context/TokenContext';
import { useWizard } from '../../context/WizardContext';
import { Button } from '../ui/Button';
import { useTelegramHaptics } from '../../hooks/useTelegram';

interface ProfileTabProps {
  onHelpClick: () => void;
  onBuyTokens?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onHelpClick, onBuyTokens }) => {
  const { tokens } = useTokens();
  const { impactOccurred } = useTelegramHaptics();

  const handleBuyTokens = () => {
    impactOccurred('light');
    if (onBuyTokens) {
      onBuyTokens();
    } else {
      // Fallback for web version
      window.location.href = '/pricing';
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Balance Section */}
      <div 
        className="rounded-2xl p-6 shadow-sm border"
        style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
        }}
      >
        <h2 
          className="text-xl font-serif font-bold mb-4"
          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          Баланс
        </h2>
        <div className="space-y-4">
          <TokenBalance />
          <DailyWheel />
          <Button
            onClick={handleBuyTokens}
            variant="primary"
            className="w-full"
          >
            Купить токены
          </Button>
        </div>
      </div>

      {/* Help Section */}
      <div 
        className="rounded-2xl p-6 shadow-sm border"
        style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
        }}
      >
        <h2 
          className="text-xl font-serif font-bold mb-4"
          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          Помощь
        </h2>
        <Button
          onClick={() => {
            impactOccurred('light');
            onHelpClick();
          }}
          variant="secondary"
          className="w-full"
        >
          Как это работает?
        </Button>
      </div>
    </div>
  );
};
