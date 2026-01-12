import React, { useState, useEffect } from 'react';
import { useTokens } from '../../context/TokenContext';

// Helper to calculate time until midnight (next bonus)
const getTimeUntilMidnight = (): { hours: number; minutes: number; seconds: number; totalSeconds: number } => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const totalSeconds = Math.floor(diff / 1000);
  
  return { hours, minutes, seconds, totalSeconds };
};

interface ComeBackReminderProps {
  onBuyTokens?: () => void;
}

export const ComeBackReminder: React.FC<ComeBackReminderProps> = ({ onBuyTokens }) => {
  const { tokens } = useTokens();
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if we should show the reminder
  const shouldShow = tokens && tokens.balance === 0 && !tokens.canClaimBonus && !isDismissed;

  useEffect(() => {
    if (shouldShow) {
      // Delay appearance for smooth animation
      const showTimer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(showTimer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow]);

  useEffect(() => {
    if (!shouldShow) return;

    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 1000);

    return () => clearInterval(timer);
  }, [shouldShow]);

  if (!shouldShow) return null;

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  // Calculate progress (24 hours = 86400 seconds)
  const progressPercent = ((86400 - timeLeft.totalSeconds) / 86400) * 100;

  return (
    <div 
      className={`
        fixed bottom-20 left-4 right-4 z-40 
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}
    >
      <div 
        className="
          relative overflow-hidden
          bg-gradient-to-br from-brand-50 via-white to-purple-50
          border border-brand-200/50 rounded-2xl p-4 shadow-lg
          backdrop-blur-sm
        "
      >
        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 overflow-hidden rounded-t-2xl">
          <div 
            className="h-full bg-gradient-to-r from-brand-400 to-purple-500 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Закрыть"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          {/* Animated icon */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-100 to-purple-100 flex items-center justify-center">
              <span className="text-2xl animate-wiggle">🎁</span>
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-2 border-brand-300 animate-ping opacity-30" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800 mb-1">
              Токены закончились!
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Приходи завтра за бесплатными токенами
            </p>

            {/* Countdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-xs font-mono bg-white rounded-lg px-2 py-1 shadow-inner">
                <span className="text-brand-600 font-bold">{formatNumber(timeLeft.hours)}</span>
                <span className="text-gray-300">:</span>
                <span className="text-brand-600 font-bold">{formatNumber(timeLeft.minutes)}</span>
                <span className="text-gray-300">:</span>
                <span className="text-brand-600 font-bold">{formatNumber(timeLeft.seconds)}</span>
              </div>
              <span className="text-[10px] text-gray-400">до бонуса</span>
            </div>
          </div>

          {/* CTA Button */}
          {onBuyTokens && (
            <button
              onClick={onBuyTokens}
              className="
                flex-shrink-0 px-4 py-2 
                bg-gradient-to-r from-brand-500 to-purple-500 
                text-white text-xs font-bold rounded-xl
                shadow-md hover:shadow-lg 
                transform hover:scale-105 active:scale-95
                transition-all duration-200
              "
            >
              Купить
            </button>
          )}
        </div>

        {/* Decorative sparkles */}
        <div className="absolute top-3 left-16 w-1 h-1 bg-brand-300 rounded-full animate-pulse" />
        <div className="absolute bottom-4 right-20 w-1.5 h-1.5 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-6 right-28 w-1 h-1 bg-pink-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
};
