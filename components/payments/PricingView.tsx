import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useTokens } from '../../context/TokenContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { trackConversion } from '../../lib/analytics';
import { getTelegramWebApp, isTelegramWebApp } from '../../lib/telegram';

interface PricingViewProps {
  onBack?: () => void;
  compact?: boolean; // For Telegram Mini App
}

export const PricingView: React.FC<PricingViewProps> = ({ onBack, compact = false }) => {
  const { tokens, refresh } = useTokens();
  const { showToast } = useToast();
  const isTelegram = isTelegramWebApp();
  const [paymentMethod, setPaymentMethod] = useState<'stars' | 'rub'>('stars');

  // Telegram Stars packages (1 Star ≈ 1.6-1.7 RUB)
  // Prices adjusted for parity with RUB prices
  const telegramPackages = [
    {
      name: 'Малый',
      tokens: 10,
      stars: 75,
      features: [
        '10 токенов',
        '~10 генераций 1K',
        '~5 генераций 2K',
        '~3 генерации 4K',
      ],
      package: 'small' as const,
      popular: false,
    },
    {
      name: 'Средний',
      tokens: 50,
      stars: 300,
      features: [
        '50 токенов',
        '~50 генераций 1K',
        '~25 генераций 2K',
        '~16 генераций 4K',
        'Лучшая цена за токен',
      ],
      package: 'medium' as const,
      popular: true,
    },
    {
      name: 'Большой',
      tokens: 100,
      stars: 500,
      features: [
        '100 токенов',
        '~100 генераций 1K',
        '~50 генераций 2K',
        '~33 генерации 4K',
        'Максимальная выгода',
      ],
      package: 'large' as const,
      popular: false,
    },
  ];

  // Regular packages (for non-Telegram users)
  const regularPackages = [
    {
      name: 'Малый',
      tokens: 10,
      price: 99,
      features: [
        '10 токенов',
        '~10 генераций 1K',
        '~5 генераций 2K',
        '~3 генерации 4K',
      ],
      package: 'small' as const,
      popular: false,
    },
    {
      name: 'Средний',
      tokens: 50,
      price: 399,
      features: [
        '50 токенов',
        '~50 генераций 1K',
        '~25 генераций 2K',
        '~16 генераций 4K',
        'Лучшая цена за токен',
      ],
      package: 'medium' as const,
      popular: true,
    },
    {
      name: 'Большой',
      tokens: 100,
      price: 699,
      features: [
        '100 токенов',
        '~100 генераций 1K',
        '~50 генераций 2K',
        '~33 генерации 4K',
        'Максимальная выгода',
      ],
      package: 'large' as const,
      popular: false,
    },
  ];

  // Determine which packages to show based on payment method
  const packages = isTelegram 
    ? (paymentMethod === 'stars' ? telegramPackages : regularPackages)
    : regularPackages;

  const handleSelectPackage = async (packageName: 'small' | 'medium' | 'large') => {
    try {
      // For Telegram users, check payment method; for non-Telegram, always use YooKassa
      const useStars = isTelegram && paymentMethod === 'stars';
      
      if (useStars) {
        // Use Telegram Stars payment
        const response = await apiRequest('/api/payments/telegram-stars', {
          method: 'POST',
          body: JSON.stringify({
            package: packageName,
          }),
        });

        const data = await response.json();
        if (data.success && data.data.invoiceLink) {
          const webApp = getTelegramWebApp();
          if (webApp) {
            // Track conversion attempt
            const packageInfo = telegramPackages.find(p => p.package === packageName);
            if (packageInfo) {
              trackConversion.upgradeSubscription(packageName, packageInfo.stars);
            }
            
            // Ensure WebApp is ready and prevent closing
            webApp.ready();
            webApp.expand();
            
            // Set up handlers to prevent app closing after payment return
            const handleVisibilityChange = () => {
              if (document.visibilityState === 'visible') {
                // App became visible again (e.g., after returning from payment)
                // Ensure app stays open
                webApp.ready();
                webApp.expand();
              }
            };
            
            const handleWindowFocus = () => {
              // When window regains focus (e.g., after returning from payment)
              webApp.ready();
              webApp.expand();
            };
            
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('focus', handleWindowFocus);
            
            // Open invoice in Telegram
            try {
              webApp.openInvoice(data.data.invoiceLink, (status: string) => {
                try {
                  // Prevent app from closing after returning from payment
                  // Use setTimeout to ensure Telegram has time to restore the app state
                  setTimeout(() => {
                    try {
                      webApp.ready();
                      webApp.expand();
                    } catch (error) {
                      console.error('Error restoring WebApp state:', error);
                    }
                    
                    // Remove handlers after payment is complete
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    window.removeEventListener('focus', handleWindowFocus);
                  }, 100);
                  
                  if (status === 'paid') {
                    showToast('Платеж успешно выполнен! Токены добавлены на ваш счет.', 'success');
                    refresh();
                    // In SPA mode, we don't redirect - just close the pricing view
                    if (onBack) {
                      onBack();
                    }
                  } else if (status === 'failed') {
                    showToast('Ошибка при оплате. Попробуйте еще раз.', 'error');
                  } else if (status === 'cancelled') {
                    showToast('Платеж отменен.', 'info');
                  } else {
                    // Handle any other status (including empty/undefined)
                    console.log('Payment returned with status:', status);
                    // Don't close the app, just show a message
                    if (status) {
                      showToast(`Платеж завершен со статусом: ${status}`, 'info');
                    }
                  }
                } catch (error) {
                  console.error('Error in payment callback:', error);
                  // Ensure app stays open even if there's an error
                  try {
                    webApp.ready();
                    webApp.expand();
                  } catch (e) {
                    console.error('Error restoring WebApp after callback error:', e);
                  }
                  showToast('Произошла ошибка при обработке платежа.', 'error');
                }
              });
            } catch (error) {
              console.error('Error opening invoice:', error);
              showToast('Ошибка при открытии платежа. Попробуйте еще раз.', 'error');
              // Remove handlers if invoice opening failed
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              window.removeEventListener('focus', handleWindowFocus);
            }
          } else {
            showToast('Ошибка: Telegram WebApp не доступен', 'error');
          }
        } else {
          showToast(data.error || 'Ошибка при создании платежа. Попробуйте еще раз.', 'error');
        }
      } else {
        // Use YooKassa payment (for both Telegram users choosing rubles and non-Telegram users)
        const response = await apiRequest('/api/payments/create', {
          method: 'POST',
          body: JSON.stringify({
            package: packageName,
            returnUrl: `${window.location.origin}/payment/success`,
            cancelUrl: `${window.location.origin}/pricing`,
          }),
        });

        const data = await response.json();
        if (data.success && data.data.confirmationUrl) {
          // Track conversion attempt
          const packageInfo = regularPackages.find(p => p.package === packageName);
          if (packageInfo && 'price' in packageInfo) {
            trackConversion.upgradeSubscription(packageName, packageInfo.price);
          }
          window.location.href = data.data.confirmationUrl;
        } else {
          showToast(data.error || 'Ошибка при создании платежа. Попробуйте еще раз.', 'error');
        }
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      showToast('Ошибка при создании платежа. Попробуйте еще раз.', 'error');
    }
  };

  return (
    <div 
      className={`${compact ? 'py-4 px-4' : 'min-h-screen py-20 px-4'}`}
      style={{
        backgroundColor: compact ? 'transparent' : 'var(--tg-theme-bg-color, #FFFCF8)',
      }}
    >
      <div className={`${compact ? 'max-w-2xl' : 'max-w-7xl'} mx-auto`}>
        {onBack && (
          <div className={compact ? 'mb-4' : 'mb-8'}>
            <button
              onClick={onBack}
              className={`flex items-center gap-2 hover:text-brand-600 transition-colors ${compact ? 'mb-2' : 'mb-4'}`}
              style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-semibold">Назад</span>
            </button>
          </div>
        )}
        <div className={`text-center ${compact ? 'mb-8' : 'mb-16'}`}>
          <h1 
            className={`${compact ? 'text-3xl' : 'text-6xl'} font-serif font-bold mb-4 ${compact ? '' : 'text-gradient bg-clip-text text-transparent text-shadow-premium'}`}
            style={{ color: compact ? 'var(--tg-theme-text-color, #000000)' : undefined }}
          >
            Купить токены
          </h1>
          <p 
            className={`${compact ? 'text-base' : 'text-xl'} leading-relaxed`}
            style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
          >
            Пополняйте баланс токенов и генерируйте изображения
          </p>
          {tokens && (
            <p className={`${compact ? 'text-base' : 'text-lg'} text-brand-600 mt-3 font-semibold ${compact ? '' : 'text-shadow-soft'}`}>
              Ваш баланс: {tokens.balance} токенов
            </p>
          )}
        </div>

        {/* Payment method toggle for Telegram users */}
        {isTelegram && (
          <div className={`flex justify-center gap-2 mb-6 ${compact ? 'mb-4' : 'mb-8'}`}>
            <button
              onClick={() => setPaymentMethod('stars')}
              className={`
                px-6 py-3 rounded-full font-semibold transition-all
                ${paymentMethod === 'stars'
                  ? 'bg-gradient-brand text-white shadow-glow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/70'
                }
              `}
              style={{
                backgroundColor: paymentMethod === 'stars' 
                  ? undefined 
                  : 'var(--tg-theme-secondary-bg-color, rgba(255, 255, 255, 0.5))',
                color: paymentMethod === 'stars'
                  ? undefined
                  : 'var(--tg-theme-text-color, #000000)',
              }}
            >
              ⭐ Stars
            </button>
            <button
              onClick={() => setPaymentMethod('rub')}
              className={`
                px-6 py-3 rounded-full font-semibold transition-all
                ${paymentMethod === 'rub'
                  ? 'bg-gradient-brand text-white shadow-glow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/70'
                }
              `}
              style={{
                backgroundColor: paymentMethod === 'rub' 
                  ? undefined 
                  : 'var(--tg-theme-secondary-bg-color, rgba(255, 255, 255, 0.5))',
                color: paymentMethod === 'rub'
                  ? undefined
                  : 'var(--tg-theme-text-color, #000000)',
              }}
            >
              ₽ Рубли
            </button>
          </div>
        )}

        <div className={`grid ${compact ? 'grid-cols-1 gap-3 sm:gap-4' : 'grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8'} max-w-6xl mx-auto px-1 sm:px-0`}>
          {packages.map((pkg) => {
            // Determine if we're showing stars or rubles based on payment method
            const showStars = isTelegram && paymentMethod === 'stars';
            const pricePerToken = showStars
              ? ('stars' in pkg ? (pkg.stars / pkg.tokens).toFixed(2) : '0')
              : ('price' in pkg ? (pkg.price / pkg.tokens).toFixed(2) : '0');
            return (
              <div
                key={pkg.name}
                className={`
                  relative rounded-3xl ${compact ? 'p-4' : 'p-8'} shadow-premium border-2 transition-all
                  ${pkg.popular 
                    ? `border-brand-500 ${compact ? '' : 'scale-105'} shadow-glow-xl` 
                    : 'border-white/30 hover:border-brand-300 hover:shadow-premium hover:-translate-y-1'
                  }
                `}
                style={{
                  backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(255, 255, 255, 0.8))',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {pkg.popular && (
                  <div className="absolute -top-4 left-[50%] -translate-x-[50%] bg-gradient-brand text-white px-5 py-2 rounded-full text-sm font-bold shadow-glow-md animate-glow">
                    Выгодно
                  </div>
                )}

                <div className={`text-center ${compact ? 'mb-4' : 'mb-8'}`}>
                  <h3 
                    className={`${compact ? 'text-xl' : 'text-2xl'} font-bold mb-3 ${compact ? '' : 'text-shadow-soft'}`}
                    style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                  >
                    {pkg.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    {showStars ? (
                      <>
                        <span 
                          className={`${compact ? 'text-3xl' : 'text-5xl'} font-bold ${compact ? '' : 'text-shadow-soft'}`}
                          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                        >
                          {'stars' in pkg ? pkg.stars : ''}
                        </span>
                        <span 
                          className="text-xl"
                          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                        >
                          ⭐
                        </span>
                      </>
                    ) : (
                      <>
                        <span 
                          className={`${compact ? 'text-3xl' : 'text-5xl'} font-bold ${compact ? '' : 'text-shadow-soft'}`}
                          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                        >
                          {'price' in pkg ? pkg.price : ''}
                        </span>
                        <span 
                          className="text-xl"
                          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                        >
                          ₽
                        </span>
                      </>
                    )}
                  </div>
                  <p 
                    className="text-sm mt-2"
                    style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                  >
                    {showStars 
                      ? `${'stars' in pkg ? (pkg.stars / pkg.tokens).toFixed(2) : '0'}⭐ за токен`
                      : `${pricePerToken}₽ за токен`
                    }
                  </p>
                </div>

                <ul className={`${compact ? 'space-y-2 mb-4' : 'space-y-4 mb-8'}`}>
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-green-500 mt-1 text-lg font-bold">✓</span>
                      <span 
                        className={`leading-relaxed ${compact ? 'text-sm' : ''}`}
                        style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  onClick={() => handleSelectPackage(pkg.package)}
                >
                  Купить {pkg.tokens} токенов
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
