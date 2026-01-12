import React from 'react';
import { TokenBalance } from '../tokens/TokenBalance';
import { DailyWheel } from '../tokens/DailyWheel';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onHelpClick: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, onHelpClick }) => {
  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Menu Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 max-w-[85vw] 
          glass-lg border-l border-white/30 shadow-premium z-50
          transform transition-transform duration-300 ease-out
          md:hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${!isOpen ? 'pointer-events-none invisible' : 'pointer-events-auto visible'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <h2 className="text-xl font-serif font-bold text-gray-900 text-shadow-soft">
              Меню
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full glass-sm hover:glass-md transition-all hover:scale-110"
              aria-label="Закрыть меню"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Navigation Items */}
            <nav className="space-y-4" aria-label="Мобильная навигация">
              <button
                onClick={() => {
                  onHelpClick();
                  onClose();
                }}
                className="w-full text-left px-4 py-3 rounded-xl glass-sm hover:glass-md transition-all hover:scale-[1.02] text-gray-700 font-semibold"
              >
                Как это работает
              </button>

              <a
                href="/pricing"
                onClick={handleLinkClick}
                className="block w-full text-left px-4 py-3 rounded-xl glass-sm hover:glass-md transition-all hover:scale-[1.02] text-gray-700 font-semibold"
              >
                Купить токены
              </a>
            </nav>

            {/* Token Section */}
            <div className="pt-4 border-t border-white/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Токены
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <TokenBalance />
                <DailyWheel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

