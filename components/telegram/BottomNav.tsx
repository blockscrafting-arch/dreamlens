import React from 'react';
import { useTelegramHaptics } from '../../hooks/useTelegram';

export type TabType = 'create' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { impactOccurred } = useTelegramHaptics();

  const handleTabClick = (tab: TabType) => {
    impactOccurred('light');
    onTabChange(tab);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#212121] border-t border-gray-200 dark:border-gray-700 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      <div className="flex items-center justify-around h-16 px-4">
        {/* Create Tab */}
        <button
          onClick={() => handleTabClick('create')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            activeTab === 'create'
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          aria-label="Создать"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={activeTab === 'create' ? 2.5 : 2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          <span className="text-xs font-medium">Создать</span>
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            activeTab === 'profile'
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          aria-label="Профиль"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={activeTab === 'profile' ? 2.5 : 2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          <span className="text-xs font-medium">Профиль</span>
        </button>
      </div>
    </nav>
  );
};
