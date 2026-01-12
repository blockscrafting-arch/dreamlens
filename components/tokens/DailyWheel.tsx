import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTokens } from '../../context/TokenContext';
import { useToast } from '../../context/ToastContext';
import { useTelegramHaptics } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';

// Helper to calculate time until midnight (next bonus)
const getTimeUntilMidnight = (): { hours: number; minutes: number; seconds: number } => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
};

// Countdown Timer Component
const CountdownTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 text-xs font-mono">
        <span 
          className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold animate-countdown-tick"
          style={{ minWidth: '24px', textAlign: 'center' }}
        >
          {formatNumber(timeLeft.hours)}
        </span>
        <span className="text-gray-400">:</span>
        <span 
          className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold"
          style={{ minWidth: '24px', textAlign: 'center' }}
        >
          {formatNumber(timeLeft.minutes)}
        </span>
        <span className="text-gray-400">:</span>
        <span 
          className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold"
          style={{ minWidth: '24px', textAlign: 'center' }}
        >
          {formatNumber(timeLeft.seconds)}
        </span>
      </div>
      <span className="text-[10px] text-gray-400">до нового спина</span>
    </div>
  );
};

export const DailyWheel: React.FC = () => {
  const { tokens, claimDailyBonus, refresh } = useTokens();
  const { showToast } = useToast();
  const { impactOccurred, notificationOccurred } = useTelegramHaptics();
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [wonAmount, setWonAmount] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartAngle, setDragStartAngle] = useState(0);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastDragTime, setLastDragTime] = useState(0);
  const [lastDragAngle, setLastDragAngle] = useState(0);
  
  const wheelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const isTelegram = isTelegramWebApp();
  const canSpin = tokens?.canClaimBonus ?? false;

  // Calculate angle from center of wheel to pointer
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (isSpinning || !canSpin) return;
    
    setIsDragging(true);
    const angle = getAngleFromCenter(clientX, clientY);
    setDragStartAngle(angle - rotation);
    setLastDragAngle(angle);
    setLastDragTime(Date.now());
    setDragVelocity(0);
    
    if (isTelegram) {
      impactOccurred('light');
    }
  }, [isSpinning, canSpin, rotation, getAngleFromCenter, isTelegram, impactOccurred]);

  // Handle drag move
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isSpinning) return;
    
    const currentAngle = getAngleFromCenter(clientX, clientY);
    const newRotation = currentAngle - dragStartAngle;
    
    // Calculate velocity
    const now = Date.now();
    const deltaTime = now - lastDragTime;
    if (deltaTime > 0) {
      const deltaAngle = currentAngle - lastDragAngle;
      const velocity = deltaAngle / deltaTime * 1000; // degrees per second
      setDragVelocity(velocity);
    }
    
    setLastDragAngle(currentAngle);
    setLastDragTime(now);
    setRotation(newRotation);
    
    // Haptic feedback during drag
    if (isTelegram && Math.abs(newRotation % 36) < 3) {
      impactOccurred('light');
    }
  }, [isDragging, isSpinning, dragStartAngle, getAngleFromCenter, lastDragTime, lastDragAngle, isTelegram, impactOccurred]);

  // Handle drag end - trigger spin if velocity is high enough
  const handleDragEnd = useCallback(async () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // If velocity is high enough, trigger spin
    const absVelocity = Math.abs(dragVelocity);
    if (absVelocity > 100 && canSpin) {
      // Calculate spin amount based on velocity (more velocity = more spins)
      const spinMultiplier = Math.min(absVelocity / 200, 5); // Cap at 5x
      const direction = dragVelocity > 0 ? 1 : -1;
      const spinAmount = direction * (1440 + Math.random() * 360) * spinMultiplier;
      
      setIsSpinning(true);
      
      if (isTelegram) {
        impactOccurred('medium');
      }
      
      // Animate to final position
      const startRotation = rotation;
      const finalRotation = startRotation + spinAmount;
      setRotation(finalRotation);
      
      // Claim bonus
      const result = await claimDailyBonus();
      
      // Wait for animation to complete
      setTimeout(async () => {
        if (result.success && result.tokensAwarded) {
          setWonAmount(result.tokensAwarded);
          setJustWon(true);
          await refresh();
          
          if (isTelegram) {
            notificationOccurred('success');
          }
          
          showToast(`Поздравляем! Вы выиграли ${result.tokensAwarded} токенов! 🎉`, 'success');
          
          setTimeout(() => {
            setJustWon(false);
            setIsSpinning(false);
          }, 3000);
        } else {
          setIsSpinning(false);
          if (isTelegram) {
            notificationOccurred('error');
          }
          showToast(result.error || 'Ошибка при получении бонуса', 'error');
        }
      }, 4000);
    }
  }, [isDragging, dragVelocity, canSpin, rotation, claimDailyBonus, refresh, showToast, isTelegram, impactOccurred, notificationOccurred]);

  // Handle click to spin (fallback for non-drag users)
  const handleClick = async () => {
    if (isSpinning || !canSpin || isDragging) return;

    setIsSpinning(true);
    
    if (isTelegram) {
      impactOccurred('medium');
    }
    
    // Start spinning animation
    const baseRotation = rotation;
    const spinAmount = 1800 + Math.random() * 720; // 5-7 full rotations
    const newRotation = baseRotation + spinAmount;
    setRotation(newRotation);

    // Claim bonus
    const result = await claimDailyBonus();
    
    // Wait for animation
    setTimeout(async () => {
      if (result.success && result.tokensAwarded) {
        setWonAmount(result.tokensAwarded);
        setJustWon(true);
        await refresh();
        
        if (isTelegram) {
          notificationOccurred('success');
        }
        
        showToast(`Поздравляем! Вы выиграли ${result.tokensAwarded} токенов! 🎉`, 'success');

        setTimeout(() => {
          setJustWon(false);
          setIsSpinning(false);
        }, 3000);
      } else {
        setIsSpinning(false);
        if (isTelegram) {
          notificationOccurred('error');
        }
        showToast(result.error || 'Ошибка при получении бонуса', 'error');
      }
    }, 4000);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Add/remove global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Wheel segments
  const segments = 10;
  const segmentAngle = 360 / segments;
  const colors = [
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#F97316', // orange
    '#06B6D4', // cyan
  ];

  // Token values for display
  const tokenValues = [1, 5, 2, 8, 3, 10, 4, 7, 2, 6];

  return (
    <div className="relative flex flex-col items-center">
      {/* Main wheel container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`
          relative flex flex-col items-center justify-center
          transition-all duration-300
          ${canSpin && !isSpinning
            ? 'cursor-grab active:cursor-grabbing'
            : canSpin ? '' : 'cursor-default'
          }
          ${isDragging ? 'scale-105' : ''}
        `}
        style={{ touchAction: 'none' }}
      >
        {/* Wheel Container - Larger size */}
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          {/* Outer glow effect when can spin */}
          {canSpin && !isSpinning && (
            <div className="absolute -inset-2 bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400 rounded-full blur-lg opacity-50 animate-glow-pulse"></div>
          )}
          
          {/* Subtle glow when waiting for next spin */}
          {!canSpin && !isSpinning && (
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full blur-md opacity-20"></div>
          )}
          
          {/* Pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
            <div 
              className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[20px] border-t-brand-600 drop-shadow-lg"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            ></div>
          </div>

          {/* Premium Wheel */}
          <div
            ref={wheelRef}
            className={`
              relative w-full h-full rounded-full overflow-hidden 
              shadow-2xl border-4 border-white/60
              ${justWon ? 'animate-pulse' : ''}
            `}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isDragging 
                ? 'none' 
                : isSpinning 
                  ? 'transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)' 
                  : 'transform 0.3s ease-out',
              boxShadow: justWon 
                ? '0 0 40px rgba(139, 92, 246, 0.6), 0 0 80px rgba(236, 72, 153, 0.4)' 
                : '0 10px 40px rgba(0,0,0,0.2)',
            }}
          >
            {/* Segments using conic-gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(
                  ${colors.map((color, i) => `${color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`).join(', ')}
                )`,
              }}
            />

            {/* Segment dividers and values */}
            {tokenValues.map((value, i) => (
              <div
                key={i}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg)`,
                }}
              >
                <span 
                  className="absolute text-white font-bold text-xs md:text-sm drop-shadow-lg"
                  style={{
                    top: '12%',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}

            {/* Premium Center circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className={`
                  w-14 h-14 md:w-16 md:h-16 rounded-full 
                  bg-gradient-to-br from-white to-gray-100
                  shadow-inner flex items-center justify-center z-10
                  border-2 border-white/80
                  ${canSpin && !isSpinning ? 'hover:scale-110 transition-transform' : ''}
                `}
                style={{
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                {isSpinning ? (
                  <div className="w-6 h-6 border-3 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                ) : canSpin ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] md:text-xs font-bold text-brand-600 leading-tight">КРУТИ</span>
                    <span className="text-[8px] md:text-[10px] text-gray-400">↻</span>
                  </div>
                ) : (
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Text below wheel */}
        <div className="mt-3 text-center">
          {isSpinning ? (
            <span className="text-sm font-semibold text-brand-600 animate-pulse">
              Крутится...
            </span>
          ) : canSpin ? (
            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold text-brand-600">
                Ежедневная рулетка
              </span>
              <span className="text-xs text-gray-400 mt-0.5">
                Потяни или нажми
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-gray-600">
                  Получено сегодня
                </span>
              </div>
              <CountdownTimer />
            </div>
          )}
        </div>

        {/* Premium Win animation */}
        {justWon && wonAmount > 0 && (
          <>
            {/* Confetti-like particles */}
            <div className="absolute inset-0 pointer-events-none overflow-visible">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-ping"
                  style={{
                    backgroundColor: colors[i % colors.length],
                    left: `${50 + Math.cos(i * 30 * Math.PI / 180) * 60}%`,
                    top: `${50 + Math.sin(i * 30 * Math.PI / 180) * 60}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '1s',
                  }}
                />
              ))}
            </div>
            
            {/* Win badge */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 animate-bounce">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full shadow-xl font-bold text-lg border-2 border-white/30"
                style={{
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)',
                }}
              >
                +{wonAmount} 🎉
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
