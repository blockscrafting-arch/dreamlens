import React from 'react';
import { Button } from '../ui/Button';

export const PaymentCancel: React.FC = () => {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full glass-lg rounded-3xl p-10 shadow-premium text-center border border-white/30 animate-pop-in">
        <div className="w-28 h-28 bg-gradient-to-br from-yellow-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-8 shadow-glow-gold animate-breathe">
          <span className="text-6xl filter drop-shadow-lg">⚠️</span>
        </div>
        
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-4 text-shadow-soft">
          Оплата отменена
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed text-lg">
          Оплата была отменена. Вы можете попробовать снова в любое время.
        </p>

        <div className="flex gap-4">
          <Button 
            variant="secondary"
            onClick={() => window.location.href = '/pricing'}
            className="flex-1"
          >
            Вернуться к тарифам
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            className="flex-1 shadow-glow-md"
          >
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
};

