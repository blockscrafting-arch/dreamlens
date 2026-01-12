import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { WizardProvider, useWizard } from '@/context/WizardContext';
import { TokenProvider, useTokens } from '@/context/TokenContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { LegalModal } from '@/components/ui/LegalModal';
import { TokenBalance } from '@/components/tokens/TokenBalance';
import { DailyWheel } from '@/components/tokens/DailyWheel';
import { ComeBackReminder } from '@/components/tokens/ComeBackReminder';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { initTelegramWebApp, getTelegramWebApp, isTelegramWebApp } from '@/lib/telegram';
import { TelegramLayout } from '@/components/telegram/TelegramLayout';
import { CreateTab } from '@/components/telegram/CreateTab';
import { ProfileTab } from '@/components/telegram/ProfileTab';
import { TelegramPricingScreen } from '@/components/telegram/TelegramPricingScreen';
import { TabType } from '@/components/telegram/BottomNav';
import { useTelegramBackButton, useTelegramHaptics } from '@/hooks/useTelegram';
import { usePathname } from '@/hooks/usePathname';

// Lazy load wizard steps for code splitting
const UploadStep = lazy(() => import('./components/wizard/UploadStep').then(module => ({ default: module.UploadStep })));
const TrendStep = lazy(() => import('./components/wizard/TrendStep').then(module => ({ default: module.TrendStep })));
const ConfigStep = lazy(() => import('./components/wizard/ConfigStep').then(module => ({ default: module.ConfigStep })));
const GenerationStep = lazy(() => import('./components/wizard/GenerationStep').then(module => ({ default: module.GenerationStep })));

// Lazy load payment pages
const PricingPage = lazy(() => import('./components/payments/PricingPage').then(module => ({ default: module.PricingPage })));
const PaymentSuccess = lazy(() => import('./components/payments/PaymentSuccess').then(module => ({ default: module.PaymentSuccess })));
const PaymentCancel = lazy(() => import('./components/payments/PaymentCancel').then(module => ({ default: module.PaymentCancel })));

// Loading fallback component
const StepLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-500">Загрузка...</p>
    </div>
  </div>
);

const WizardContent: React.FC = () => {
  const { step, setStep, userImages, config } = useWizard();
  const isTelegram = isTelegramWebApp();

  // UX: Automatically scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Navigation Logic
  const canGoToStep = (targetStep: number) => {
    // You can always go back
    if (targetStep < step) return true;
    
    // Step 1 check (Photos)
    if (targetStep > 1) {
        if (userImages.length < 3) return false;
    }

    // Step 2 check (Style)
    if (targetStep > 2) {
        if (!config.trend) return false;
    }

    // Step 3 check (Details) - always valid if Step 2 is done
    if (targetStep > 3) {
        // Should only be accessible via the "Generate" button normally, but allowing if trend is set
        return true; 
    }

    return true;
  };

  const handleNavClick = (targetStep: number) => {
    if (canGoToStep(targetStep)) {
        setStep(targetStep);
    }
  };

  const steps = [
    { id: 1, label: 'Фото' },
    { id: 2, label: 'Стиль' },
    { id: 3, label: 'Детали' },
    { id: 4, label: 'Финал' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-6 sm:py-8 overflow-hidden">
      {/* Premium Interactive Progress Bar (hidden in Telegram) */}
      {!isTelegram && (
      <div className="mb-12 max-w-2xl mx-auto">
        <div className="relative">
            {/* Background Line */}
            <div className="absolute top-[50%] left-0 w-full h-2 bg-gray-100/50 rounded-full -translate-y-[50%] z-0 backdrop-blur-sm"></div>
            
            {/* Premium Active Progress Line with Glow */}
            <div 
                className="absolute top-[50%] left-0 h-2 bg-gradient-brand rounded-full -translate-y-[50%] z-0 transition-all duration-700 ease-in-out shadow-glow-md"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
            >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-shimmer opacity-30 animate-shimmer"></div>
            </div>

            {/* Step Dots & Labels */}
            <div className="flex justify-between items-center relative z-10 w-full">
                {steps.map((s) => {
                    const isActive = step === s.id;
                    const isCompleted = step > s.id;
                    const isAccessible = canGoToStep(s.id);

                    return (
                        <div key={s.id} className="flex flex-col items-center">
                            <button
                                onClick={() => handleNavClick(s.id)}
                                disabled={!isAccessible}
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 transform
                                    ${isActive 
                                        ? 'bg-brand-600 border-brand-600 scale-125 shadow-lg shadow-brand-300' 
                                        : isCompleted 
                                            ? 'bg-brand-500 border-brand-500 scale-100' 
                                            : 'bg-white border-gray-300 scale-90'
                                    }
                                    ${isAccessible ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-60'}
                                `}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4 text-white animate-pop-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                        {s.id}
                                    </span>
                                )}
                            </button>
                            <span 
                                onClick={() => isAccessible && handleNavClick(s.id)}
                                className={`
                                    mt-2 text-xs font-bold uppercase tracking-widest transition-colors duration-300 cursor-pointer
                                    ${isActive ? 'text-brand-600 translate-y-0' : isCompleted ? 'text-brand-400' : 'text-gray-300'}
                                    ${!isAccessible && 'pointer-events-none'}
                                `}
                            >
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
      )}

      <div className="min-h-[70vh] transition-all duration-500">
        <Suspense fallback={<StepLoader />}>
          {step === 1 && <UploadStep />}
          {step === 2 && <TrendStep />}
          {step === 3 && <ConfigStep />}
          {step === 4 && <GenerationStep />}
        </Suspense>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [modalOpen, setModalOpen] = useState<'privacy' | 'terms' | 'help' | null>(null);
  const pathname = usePathname();
  
  // Initialize Telegram WebApp on mount
  useEffect(() => {
    if (isTelegramWebApp()) {
      initTelegramWebApp();
      const webApp = getTelegramWebApp();
      if (webApp) {
        webApp.ready();
      }
    }
  }, []);

  const privacyContent = (
      <>
        <h3 className="font-bold text-gray-800 mb-3">1. Сбор и использование данных</h3>
        <p className="mb-4">DreamLens AI собирает минимально необходимые данные для предоставления сервиса:</p>
        <ul className="list-disc ml-5 mb-4 space-y-2">
          <li>Фотографии загружаются вами и обрабатываются через Google Gemini API</li>
          <li>Мы не храним ваши исходные фотографии на наших серверах после обработки</li>
          <li>Сгенерированные изображения могут сохраняться для истории генераций в вашем браузере (IndexedDB)</li>
          <li>Для анонимных пользователей используется device ID</li>
        </ul>

        <h3 className="font-bold text-gray-800 mb-3">2. Обработка данных третьими лицами</h3>
        <p className="mb-4">Ваши изображения обрабатываются через Google Gemini API в соответствии с политикой конфиденциальности Google. Мы не передаем ваши данные другим третьим лицам без вашего согласия.</p>

        <h3 className="font-bold text-gray-800 mb-3">3. Платежные данные</h3>
        <p className="mb-4">Платежи обрабатываются через ЮKassa. Мы не храним и не имеем доступа к вашим банковским данным. Все платежные операции защищены стандартами PCI DSS.</p>

        <h3 className="font-bold text-gray-800 mb-3">4. Cookies и аналитика</h3>
        <p className="mb-4">Мы используем Google Analytics для анализа использования сервиса. Вы можете отключить cookies в настройках браузера.</p>

        <h3 className="font-bold text-gray-800 mb-3">5. Ваши права</h3>
        <p className="mb-4">Вы имеете право запросить удаление ваших данных, обратившись к нам через контактную информацию на сайте.</p>

        <p className="text-xs text-gray-500 mt-6">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
      </>
  );

  const termsContent = (
      <>
        <h3 className="font-bold text-gray-800 mb-3">1. Принятие условий</h3>
        <p className="mb-4">Используя DreamLens AI, вы соглашаетесь с данными условиями использования. Если вы не согласны с условиями, пожалуйста, не используйте сервис.</p>

        <h3 className="font-bold text-gray-800 mb-3">2. Возрастные ограничения</h3>
        <p className="mb-4">Сервис предназначен для лиц старше 13 лет. Лицам младше 18 лет требуется согласие родителей или опекунов.</p>

        <h3 className="font-bold text-gray-800 mb-3">3. Правила использования</h3>
        <p className="mb-4">Вы обязуетесь:</p>
        <ul className="list-disc ml-5 mb-4 space-y-2">
          <li>Использовать сервис только для законных целей</li>
          <li>Не загружать контент, нарушающий права третьих лиц</li>
          <li>Не создавать дипфейки публичных личностей без их согласия</li>
          <li>Не генерировать контент 18+ или незаконный контент</li>
          <li>Не использовать сервис для мошенничества или обмана</li>
        </ul>

        <h3 className="font-bold text-gray-800 mb-3">4. Интеллектуальная собственность</h3>
        <p className="mb-4">Сгенерированные изображения принадлежат вам. Однако вы не можете использовать их для коммерческих целей без соответствующей лицензии на исходные фотографии.</p>

        <h3 className="font-bold text-gray-800 mb-3">5. Ограничение ответственности</h3>
        <p className="mb-4">Мы не гарантируем 100% сходство сгенерированных изображений с исходными фотографиями. Сервис предоставляется "как есть". Мы не несем ответственности за использование сгенерированных изображений.</p>

        <h3 className="font-bold text-gray-800 mb-3">6. Платежи и возвраты</h3>
        <p className="mb-4">Покупка токенов является финальной. Возврат средств возможен только в случае технических проблем с сервисом, не позволяющих использовать купленные токены.</p>

        <h3 className="font-bold text-gray-800 mb-3">7. Изменение условий</h3>
        <p className="mb-4">Мы оставляем за собой право изменять условия использования. Продолжение использования сервиса после изменений означает ваше согласие с новыми условиями.</p>

        <p className="text-xs text-gray-500 mt-6">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
      </>
  );

    const helpContent = (
      <>
        <p><strong>Как получить лучший результат?</strong></p>
        <ul className="list-disc ml-5 space-y-2 mt-2">
            <li>Загружайте фото с хорошим светом.</li>
            <li>Лицо не должно быть перекрыто очками или волосами.</li>
            <li>Используйте стиль <b>Minimalist</b> или <b>Professional</b> для максимального сходства.</li>
            <li>Если лицо выглядит &quot;пластиковым&quot;, попробуйте добавить в правки: &quot;Add film grain, skin texture&quot;.</li>
        </ul>
      </>
  );

  return (
    <WizardProvider>
      <ToastProvider>
        <TokenProvider>
          <AppContent 
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            privacyContent={privacyContent}
            termsContent={termsContent}
            helpContent={helpContent}
            pathname={pathname}
          />
        </TokenProvider>
      </ToastProvider>
    </WizardProvider>
  );
};

const AppContent: React.FC<{
  modalOpen: 'privacy' | 'terms' | 'help' | null;
  setModalOpen: (modal: 'privacy' | 'terms' | 'help' | null) => void;
  privacyContent: React.ReactNode;
  termsContent: React.ReactNode;
  helpContent: React.ReactNode;
  pathname: string;
  }> = ({ modalOpen, setModalOpen, privacyContent, termsContent, helpContent, pathname }) => {
  const { showToast } = useToast();
  const { tokens } = useTokens();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Welcome Bonus Notification
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('dreamlens_welcome_seen');
    if (!hasSeenWelcome && tokens && tokens.balance > 0) {
      showToast('Добро пожаловать! Вам начислен приветственный бонус 🎁', 'success');
      localStorage.setItem('dreamlens_welcome_seen', 'true');
    }
  }, [tokens, showToast]);
  
  if (pathname === '/pricing') {
    return (
      <Suspense fallback={<StepLoader />}>
        <PricingPage />
      </Suspense>
    );
  }
  
  if (pathname === '/payment/success') {
    return (
      <Suspense fallback={<StepLoader />}>
        <PaymentSuccess />
      </Suspense>
    );
  }
  
  if (pathname === '/payment/cancel') {
    return (
      <Suspense fallback={<StepLoader />}>
        <PaymentCancel />
      </Suspense>
    );
  }

  const isTelegram = isTelegramWebApp();
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [telegramScreen, setTelegramScreen] = useState<'tabs' | 'pricing'>('tabs');
  const { step, setStep } = useWizard();
  const { show: showBackButton, hide: hideBackButton } = useTelegramBackButton();
  const { impactOccurred } = useTelegramHaptics();

  // Handle back button navigation in Telegram
  useEffect(() => {
    if (!isTelegram) return;

    const handleBack = () => {
      // Haptic feedback on back button press
      impactOccurred('light');
      
      // If on pricing screen, go back to tabs
      if (telegramScreen === 'pricing') {
        setTelegramScreen('tabs');
        return;
      }

      // If on profile tab, switch to create tab
      if (activeTab === 'profile') {
        setActiveTab('create');
        return;
      }

      // If on create tab and step > 1, go to previous step
      if (activeTab === 'create' && step > 1) {
        setStep(step - 1);
        return;
      }

      // If on create tab and step === 1, hide back button (do nothing)
      // Back button will be hidden below
    };

    // Show/hide back button based on current state
    if (telegramScreen === 'pricing') {
      // Always show back button on pricing screen
      showBackButton(handleBack);
    } else if (activeTab === 'profile') {
      // Show back button on profile tab
      showBackButton(handleBack);
    } else if (activeTab === 'create' && step > 1) {
      // Show back button on create tab if not on first step
      showBackButton(handleBack);
    } else {
      // Hide back button on create tab, step 1
      hideBackButton();
    }
  }, [isTelegram, telegramScreen, activeTab, step, setStep, showBackButton, hideBackButton, impactOccurred]);

  // Telegram Mini App Layout
  if (isTelegram) {
    return (
      <>
        {/* Legal Modals */}
        <LegalModal 
            isOpen={modalOpen === 'privacy'} 
            onClose={() => setModalOpen(null)} 
            title="Политика конфиденциальности"
            content={privacyContent}
        />
        <LegalModal 
            isOpen={modalOpen === 'terms'} 
            onClose={() => setModalOpen(null)} 
            title="Условия использования"
            content={termsContent}
        />
        <LegalModal 
            isOpen={modalOpen === 'help'} 
            onClose={() => setModalOpen(null)} 
            title="Как это работает"
            content={helpContent}
        />
        {telegramScreen === 'tabs' ? (
          <TelegramLayout activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 'create' ? (
              <CreateTab />
            ) : (
              <ProfileTab 
                onHelpClick={() => setModalOpen('help')}
                onBuyTokens={() => setTelegramScreen('pricing')}
              />
            )}
          </TelegramLayout>
        ) : (
          <TelegramPricingScreen 
            onBack={() => setTelegramScreen('tabs')}
          />
        )}
        {/* Come Back Reminder for Telegram */}
        <ComeBackReminder onBuyTokens={() => setTelegramScreen('pricing')} />
      </>
    );
  }

  // Web Layout (existing)
  return (
    <div className="min-h-screen bg-cream text-gray-800 font-sans selection:bg-brand-200 selection:text-brand-900">
        {/* Legal Modals */}
        <LegalModal 
            isOpen={modalOpen === 'privacy'} 
            onClose={() => setModalOpen(null)} 
            title="Политика конфиденциальности"
            content={privacyContent}
        />
        <LegalModal 
            isOpen={modalOpen === 'terms'} 
            onClose={() => setModalOpen(null)} 
            title="Условия использования"
            content={termsContent}
        />
        <LegalModal 
            isOpen={modalOpen === 'help'} 
            onClose={() => setModalOpen(null)} 
            title="Как это работает"
            content={helpContent}
        />

        <header className="glass-lg sticky top-0 z-40 border-b border-white/30 shadow-premium transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition-opacity">
              <div className="w-12 h-12 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-md group-hover:scale-110 transition-transform text-xl text-white group-hover:rotate-12 duration-300 animate-glow">
                ✨
              </div>
              <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-tight text-shadow-soft">
                DreamLens<span className="text-brand-500 animate-pulse-slow">.ai</span>
              </h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide text-gray-500" aria-label="Основная навигация">
                <button 
                  onClick={() => setModalOpen('help')} 
                  className="hover:text-brand-600 transition-all hover:scale-105 transform inline-block hover:text-shadow-soft"
                  aria-label="Открыть справку"
                >
                  Как это работает
                </button>
                <HeaderAuth />
            </nav>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full glass-sm hover:glass-md transition-all hover:scale-110"
              aria-label="Открыть меню"
              aria-expanded={mobileMenuOpen}
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile Menu */}
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onHelpClick={() => setModalOpen('help')}
        />

        {/* Main Content */}
        <main>
          <WizardContent />
        </main>

        {/* Come Back Reminder - shown when tokens are 0 */}
        <ComeBackReminder onBuyTokens={() => window.location.href = '/pricing'} />

        {/* Footer */}
        <footer className="glass-sm py-12 mt-12 border-t border-white/20 bg-gradient-to-b from-white/50 to-cream/50">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h3 className="font-serif font-bold text-xl text-gray-800 mb-2 text-shadow-soft">DreamLens AI</h3>
                    <p className="text-gray-400 text-sm">Твой персональный AI-фотограф.</p>
                </div>
                <nav className="flex gap-6 text-gray-400 text-sm" aria-label="Футер навигация">
                    <button 
                      onClick={() => setModalOpen('privacy')} 
                      className="hover:text-brand-500 transition-all hover:scale-105"
                      aria-label="Политика конфиденциальности"
                    >
                      Privacy
                    </button>
                    <button 
                      onClick={() => setModalOpen('terms')} 
                      className="hover:text-brand-500 transition-all hover:scale-105"
                      aria-label="Условия использования"
                    >
                      Terms
                    </button>
                    <a 
                      href="#" 
                      className="hover:text-brand-500 transition-all hover:scale-105"
                      aria-label="Instagram профиль"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram
                    </a>
                </nav>
            </div>
        </footer>
    </div>
  );
};

const HeaderAuth: React.FC = () => {
  return (
    <div className="flex items-center gap-4">
      <TokenBalance />
      <DailyWheel />
      <a 
        href="/pricing" 
        className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-brand-600 transition-all hover:scale-105"
      >
        Купить токены
      </a>
    </div>
  );
};

export default App;
