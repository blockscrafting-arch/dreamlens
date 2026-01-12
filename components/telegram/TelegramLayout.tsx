import React, { useState } from 'react';
import { BottomNav, TabType } from './BottomNav';
import { TokenBalance } from '../tokens/TokenBalance';
import { DailyWheelButton } from '../tokens/DailyWheelButton';
import { useTelegramTheme } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';

interface TelegramLayoutProps {
  children: React.ReactNode;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export const TelegramLayout: React.FC<TelegramLayoutProps> = ({
  children,
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('create');
  const theme = useTelegramTheme();

  // Use external tab control if provided, otherwise use internal state
  const activeTab = externalActiveTab ?? internalActiveTab;
  const handleTabChange = externalOnTabChange ?? setInternalActiveTab;

  // Apply Telegram theme colors to body
  React.useEffect(() => {
    if (!isTelegramWebApp() || !theme) return;

    const body = document.body;
    body.style.backgroundColor = theme.bgColor;
    body.style.color = theme.textColor;

    return () => {
      body.style.backgroundColor = '';
      body.style.color = '';
    };
  }, [theme]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: theme?.bgColor || 'var(--tg-theme-bg-color, #ffffff)',
        color: theme?.textColor || 'var(--tg-theme-text-color, #000000)',
        paddingBottom: '4rem', // Space for bottom nav
      }}
    >
      {/* Header - Minimal, native style */}
      <header 
        className="sticky top-0 z-40"
        style={{
          backgroundColor: theme?.bgColor || 'var(--tg-theme-bg-color, #ffffff)',
          borderBottom: `1px solid var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))`,
        }}
      >
        <div className="px-4 h-12 flex items-center justify-between">
          <h1 
            className="text-base font-semibold"
            style={{ color: theme?.textColor || 'var(--tg-theme-text-color, #000000)' }}
          >
            DreamLens
          </h1>
          <div className="flex items-center gap-2">
            <TokenBalance />
            <DailyWheelButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};
