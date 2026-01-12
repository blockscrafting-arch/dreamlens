import React, { useEffect } from 'react';
import { Button } from '../ui/Button';
import { useSubscription } from '../../context/SubscriptionContext';

export const PaymentSuccess: React.FC = () => {
  const { refresh } = useSubscription();

  useEffect(() => {
    // Refresh subscription status after payment
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full glass-lg rounded-3xl p-10 shadow-premium text-center border border-white/30 animate-pop-in">
        <div className="w-28 h-28 bg-gradient-to-br from-green-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-8 shadow-glow-green animate-breathe">
          <span className="text-6xl filter drop-shadow-lg">✓</span>
        </div>
        
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-4 text-shadow-soft">
          Оплата успешна!
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed text-lg">
          Ваша подписка активирована. Теперь вы можете пользоваться всеми преимуществами выбранного плана.
        </p>

        <Button 
          onClick={() => window.location.href = '/'}
          className="w-full shadow-glow-md"
        >
          Начать использовать
        </Button>
      </div>
    </div>
  );
};

