import React, { useState } from 'react';
import { useTokens } from '../../context/TokenContext';
import { useToast } from '../../context/ToastContext';

export const DailyBonus: React.FC = () => {
  const { tokens, claimDailyBonus, refresh } = useTokens();
  const { showToast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  const handleClaim = async () => {
    if (isClaiming || !tokens?.canClaimBonus) return;

    setIsClaiming(true);
    const result = await claimDailyBonus();
    
    if (result.success) {
      setJustClaimed(true);
      await refresh();
      
      showToast(`Бонус получен! +${result.tokensAwarded} токенов`, 'success');

      // Reset animation after 2 seconds
      setTimeout(() => {
        setJustClaimed(false);
      }, 2000);
    } else {
      // alert(result.error || 'Ошибка при получении бонуса');
      showToast(result.error || 'Ошибка при получении бонуса', 'error');
    }
    
    setIsClaiming(false);
  };

  const canClaim = tokens?.canClaimBonus ?? false;

  return (
    <button
      onClick={handleClaim}
      disabled={!canClaim || isClaiming}
      className={`
        relative px-4 py-2 rounded-full font-semibold text-sm
        transition-all duration-300 transform
        ${canClaim && !isClaiming
          ? 'bg-gradient-to-r from-brand-500 to-purple-500 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }
        ${justClaimed ? 'animate-bounce' : ''}
      `}
    >
      {isClaiming ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Получение...
        </span>
      ) : canClaim ? (
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
          Получить 3 токена
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Бонус получен
        </span>
      )}
      
      {justClaimed && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          +3
        </div>
      )}
    </button>
  );
};

