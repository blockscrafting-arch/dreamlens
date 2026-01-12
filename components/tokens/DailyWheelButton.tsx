import React, { useState } from 'react';
import { useTokens } from '../../context/TokenContext';
import { DailyWheelModal } from './DailyWheelModal';

export const DailyWheelButton: React.FC = () => {
  const { tokens } = useTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const canSpin = tokens?.canClaimBonus ?? false;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`
          relative flex items-center justify-center
          w-10 h-10 rounded-full
          transition-all duration-300
          ${canSpin 
            ? 'bg-gradient-to-br from-brand-500 to-purple-600 shadow-glow-md hover:shadow-glow-lg hover:scale-110 active:scale-95' 
            : 'bg-gray-100 hover:bg-gray-200'
          }
        `}
        aria-label={canSpin ? 'Крутить рулетку' : 'Ежедневный бонус'}
      >
        {/* Wheel icon */}
        <span className={`text-lg ${canSpin ? 'animate-wiggle' : ''}`}>
          {canSpin ? '🎡' : '🎁'}
        </span>
        
        {/* Pulsing indicator when bonus available */}
        {canSpin && (
          <>
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-white"></span>
            </span>
            {/* Glow ring animation */}
            <span className="absolute inset-0 rounded-full animate-glow-pulse"></span>
          </>
        )}
      </button>
      
      <DailyWheelModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};
