import React from 'react';
import { useTokens } from '../../context/TokenContext';

export const TokenBalance: React.FC = () => {
  const { tokens, loading } = useTokens();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        <span className="text-sm text-gray-500">Загрузка...</span>
      </div>
    );
  }

  const balance = tokens?.balance || 0;
  const freeRemaining = tokens?.freeGenerations?.remaining || 0;

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Free generations badge */}
      {freeRemaining > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 md:gap-1.5 md:px-3 md:py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full border border-green-200/50 glass-sm shadow-soft">
          <span className="text-xs md:text-sm">🎁</span>
          <span className="text-xs md:text-sm font-bold text-green-700">
            {freeRemaining} бесп.
          </span>
        </div>
      )}
      
      {/* Token balance */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 md:gap-2 md:px-4 md:py-2 bg-gradient-to-r from-brand-100 to-purple-100 rounded-full border border-brand-200/50 glass-sm shadow-soft hover:shadow-soft-md transition-all hover:scale-105">
        <svg 
          className="w-4 h-4 md:w-5 md:h-5 text-brand-600 filter drop-shadow-sm" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span className="text-xs md:text-sm font-bold text-brand-700 text-shadow-soft">
          {balance} <span className="hidden sm:inline">токенов</span>
        </span>
      </div>
    </div>
  );
};

