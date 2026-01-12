import React, { useState, useEffect } from 'react';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { TrendType } from '../../types';
import { Button } from '../ui/Button';
import { rateLimiter } from '../../utils/rateLimit';
import { apiRequest } from '../../lib/api';
import { useTelegramMainButton, useTelegramHaptics } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';

export const TrendStep: React.FC = () => {
  const { config, updateConfig, setStep } = useWizard();
  const { showToast } = useToast();
  const [luckyLoading, setLuckyLoading] = useState(false);
  const isTelegram = isTelegramWebApp();
  const { show: showMainButton, hide: hideMainButton } = useTelegramMainButton();
  const { impactOccurred } = useTelegramHaptics();

  const handleLucky = async () => {
    // Check rate limit
    const rateLimitCheck = rateLimiter.canMakeRequest();
    if (!rateLimitCheck.allowed) {
      showToast(rateLimitCheck.reason || 'Превышен лимит запросов. Подождите немного.', 'error');
      return;
    }

    setLuckyLoading(true);
    try {
        rateLimiter.recordRequest();
        
        // Call server API for creative idea generation
        const response = await apiRequest('/api/generate/idea', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const creativePrompt = data.data?.idea;
          
          if (creativePrompt) {
            updateConfig({ 
              trend: TrendType.CUSTOM, 
              userPrompt: creativePrompt 
            });
          } else {
            throw new Error('Server did not return idea');
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
    } catch (e) {
        console.error("Feeling lucky failed", e);
        // Fallback to default prompt
        updateConfig({ trend: TrendType.CUSTOM, userPrompt: "Портрет в стиле кибер-ренессанса" });
    } finally {
        setLuckyLoading(false);
        setStep(3); // Move to config only after prompt is generated
    }
  };

  const handleCustom = () => {
      // Clear previous prompt so user starts fresh
      updateConfig({ trend: TrendType.CUSTOM, userPrompt: "" });
      setStep(3);
  };

  const handleSelectTrend = (trendId: TrendType) => {
      updateConfig({ trend: trendId });
      // Auto-advance to next step
      setTimeout(() => setStep(3), 150);
  };

  // NEW: Added 'tags' for visual clarity (Lighting, Texture, Color)
  const trends = {
    [TrendType.MAGAZINE]: {
      id: TrendType.MAGAZINE,
      title: "DAZED",
      subtitle: "Editorial",
      desc: "Авангард, геометрия и высокая мода",
      emoji: "📸",
      tags: ["Жесткая вспышка", "Контраст", "Резкость"],
      gradient: "bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white",
      textColor: "text-white"
    },
    [TrendType.A_LA_RUSSE]: {
        id: TrendType.A_LA_RUSSE,
        title: "A LA RUSSE",
        subtitle: "Imperial",
        desc: "Роскошная зима и аристократия",
        emoji: "❄️",
        tags: ["Холодный тон", "Мягкий фокус", "Дневной свет"],
        gradient: "bg-gradient-to-br from-red-800 via-red-900 to-black text-white",
        textColor: "text-white"
    },
    [TrendType.MOB_WIFE]: {
        id: TrendType.MOB_WIFE,
        title: "MOB WIFE",
        subtitle: "Luxe",
        desc: "Дерзкий гламур 90-х и меха",
        emoji: "🐆",
        tags: ["Теплый тон", "Винтажная вспышка", "Текстура"],
        gradient: "bg-gradient-to-br from-yellow-700 via-yellow-800 to-amber-900 text-amber-50",
        textColor: "text-amber-50"
    },
    [TrendType.SPORT_CHIC]: {
        id: TrendType.SPORT_CHIC,
        title: "OFF-DUTY",
        subtitle: "Paparazzi",
        desc: "Стиль принцессы Дианы, спорт-шик",
        emoji: "🧢",
        tags: ["Смаз в движении", "Естественность", "Живой кадр"],
        gradient: "bg-gradient-to-br from-emerald-600 via-green-700 to-emerald-800 text-white",
        textColor: "text-white"
    },
    [TrendType.CYBER_ANGEL]: {
        id: TrendType.CYBER_ANGEL,
        title: "ANGEL",
        subtitle: "Y3K",
        desc: "Цифровая дива и webcore",
        emoji: "🪽",
        tags: ["Голография", "Стеклянная кожа", "Сияние"],
        gradient: "bg-gradient-to-br from-blue-50 via-white to-blue-100 text-blue-900 border border-blue-200",
        textColor: "text-blue-900"
    },
    [TrendType.COUPLE]: {
      id: TrendType.COUPLE,
      title: "CINEMA",
      subtitle: "Wong Kar-wai",
      desc: "Любовное настроение и огни города",
      emoji: "🎬",
      tags: ["Боке", "Неон", "Атмосфера"],
      gradient: "bg-gradient-to-br from-rose-500 via-red-600 to-rose-700 text-white",
      textColor: "text-white"
    },
    [TrendType.RETRO_2K17]: {
      id: TrendType.RETRO_2K17,
      title: "INDIE",
      subtitle: "Sleaze",
      desc: "Шумная вечеринка и вспышка",
      emoji: "📼",
      tags: ["Прямая вспышка", "Зернистость", "Небрежность"],
      gradient: "bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white",
      textColor: "text-white"
    },
    [TrendType.OFFICE_SIREN]: {
      id: TrendType.OFFICE_SIREN,
      title: "SIREN",
      subtitle: "Office Core",
      desc: "Строгая, опасная, в очках",
      emoji: "👓",
      tags: ["Холодный свет", "Резкость", "Минимализм"],
      gradient: "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-slate-900",
      textColor: "text-slate-900"
    },
    [TrendType.OLD_MONEY]: {
      id: TrendType.OLD_MONEY,
      title: "HERITAGE",
      subtitle: "Quiet Luxury",
      desc: "Тихая роскошь и загородный клуб",
      emoji: "🥂",
      tags: ["Пленочное зерно", "Теплое солнце", "Мягкость"],
      gradient: "bg-gradient-to-br from-orange-50 via-amber-100 to-amber-200 text-amber-900",
      textColor: "text-amber-900"
    },
    [TrendType.MINIMALIST]: {
      id: TrendType.MINIMALIST,
      title: "SKIN",
      subtitle: "Clean Girl",
      desc: "Честный портрет, текстура кожи",
      emoji: "☁️",
      tags: ["Без макияжа", "Текстура", "Студия"],
      gradient: "bg-gradient-to-br from-white via-gray-100 to-gray-200 text-gray-800 border border-gray-200",
      textColor: "text-gray-800"
    },
    [TrendType.ETHEREAL]: {
      id: TrendType.ETHEREAL,
      title: "FANTASY",
      subtitle: "Art",
      desc: "Эльфийская магия и сказка",
      emoji: "🦋",
      tags: ["Свечение", "Искры", "Перламутр"],
      gradient: "bg-gradient-to-br from-teal-200 via-emerald-200 to-teal-300 text-teal-900",
      textColor: "text-teal-900"
    },
    [TrendType.NEON_CYBER]: {
      id: TrendType.NEON_CYBER,
      title: "LIQUID",
      subtitle: "Chrome",
      desc: "Жидкий металл и киберпанк",
      emoji: "💿",
      tags: ["3D Рендер", "Отражения", "Неон"],
      gradient: "bg-gradient-to-br from-fuchsia-700 via-purple-800 to-indigo-900 text-white",
      textColor: "text-white"
    },
    [TrendType.PROFESSIONAL]: {
      id: TrendType.PROFESSIONAL,
      title: "FORBES",
      subtitle: "Visionary",
      desc: "Tech CEO, деловой портрет",
      emoji: "💼",
      tags: ["Свет Рембрандта", "Глубина", "Чистота"],
      gradient: "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 text-white",
      textColor: "text-white"
    },
    [TrendType.COQUETTE]: {
      id: TrendType.COQUETTE,
      title: "COQUETTE",
      subtitle: "Dreamy",
      desc: "Романтика Софии Копполы",
      emoji: "🎀",
      tags: ["Дымка", "Пастель", "Нежность"],
      gradient: "bg-gradient-to-br from-pink-200 via-rose-200 to-pink-300 text-rose-900",
      textColor: "text-rose-900"
    },
    [TrendType.DARK_ACADEMIA]: {
      id: TrendType.DARK_ACADEMIA,
      title: "GOTHIC",
      subtitle: "Academia",
      desc: "Тайное общество и старина",
      emoji: "📚",
      tags: ["Темный", "Свечи", "Твид"],
      gradient: "bg-gradient-to-br from-stone-800 via-stone-900 to-black text-stone-200",
      textColor: "text-stone-200"
    },
    [TrendType.Y2K_POP]: {
      id: TrendType.Y2K_POP,
      title: "2000s",
      subtitle: "Icon",
      desc: "Гламур нулевых и стразы",
      emoji: "💄",
      tags: ["Пересвет", "Розовый тинт", "Глянец"],
      gradient: "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white",
      textColor: "text-white"
    },
    [TrendType.COTTAGECORE]: {
      id: TrendType.COTTAGECORE,
      title: "VINTAGE",
      subtitle: "Film",
      desc: "Гордость и предубеждение",
      emoji: "🌻",
      tags: ["Золотой час", "Масло", "Природа"],
      gradient: "bg-gradient-to-br from-lime-200 via-green-200 to-green-300 text-green-900",
      textColor: "text-green-900"
    }
  };

  const categories = [
    {
        title: "🔥 Сейчас в тренде",
        items: [trends[TrendType.A_LA_RUSSE], trends[TrendType.MOB_WIFE], trends[TrendType.OFFICE_SIREN], trends[TrendType.CYBER_ANGEL]]
    },
    {
        title: "🎀 Girlhood & Vibe",
        items: [trends[TrendType.COQUETTE], trends[TrendType.Y2K_POP], trends[TrendType.SPORT_CHIC], trends[TrendType.COTTAGECORE]]
    },
    {
        title: "💎 Статус и Стиль",
        items: [trends[TrendType.OLD_MONEY], trends[TrendType.MINIMALIST], trends[TrendType.PROFESSIONAL]]
    },
    {
        title: "🎞️ Кино и Атмосфера",
        items: [trends[TrendType.RETRO_2K17], trends[TrendType.NEON_CYBER], trends[TrendType.COUPLE], trends[TrendType.MAGAZINE]]
    },
    {
        title: "🧚‍♀️ Арт и Фантазии",
        items: [trends[TrendType.ETHEREAL]]
    }
  ];

  // Setup Telegram MainButton
  useEffect(() => {
    if (!isTelegram) return;

    if (config.trend && !luckyLoading) {
      showMainButton('Настроить детали', () => {
        impactOccurred('medium');
        setStep(3);
      }, true);
    } else {
      hideMainButton();
    }

    return () => {
      hideMainButton();
    };
  }, [config.trend, luckyLoading, isTelegram, showMainButton, hideMainButton, setStep, impactOccurred]);

  // Note: Telegram BackButton is managed centrally in App.tsx to avoid conflicts

  return (
    <div className="pb-10 px-2 sm:px-4 max-w-full overflow-hidden">
      {/* Back button for web - positioned at top left */}
      {!isTelegram && (
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 text-gray-500 hover:text-brand-600 transition-colors mb-6 group"
        >
          <svg 
            className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Назад к фото</span>
        </button>
      )}
      
      <div className="mb-10 text-center">
        <h2 
          className="text-4xl md:text-5xl font-serif font-bold mb-4"
          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          Выбери эстетику
        </h2>
        <p 
          className="text-base max-w-2xl mx-auto leading-relaxed"
          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
        >
          Кликни на стиль, чтобы продолжить. Мы адаптируем освещение и атмосферу под твое лицо.
        </p>
      </div>

      <div className="space-y-10">
        {categories.map((category, catIdx) => (
            <div key={catIdx} className="animate-fade-in-up" style={{ animationDelay: `${catIdx * 100}ms` }}>
                <h3 
                  className="text-lg font-semibold mb-6"
                  style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                >
                    {category.title}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                    {category.items.filter(Boolean).map((trend: any, itemIdx: number) => (
                        <div
                            key={trend.id}
                            onClick={() => handleSelectTrend(trend.id)}
                            className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-5 cursor-pointer transition-all duration-300 ease-out h-40 sm:h-48 flex flex-col justify-between animate-fade-in-up ${trend.gradient} ${
                              config.trend === trend.id 
                                ? 'ring-2 ring-white/50 shadow-lg scale-[1.02]' 
                                : 'hover:shadow-md hover:scale-[1.01] active:scale-[0.98]'
                            }`}
                            style={{
                              animationDelay: `${(catIdx * 100) + (itemIdx * 50)}ms`,
                              animationFillMode: 'backwards',
                            }}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <h4 
                                      className={`text-sm sm:text-lg font-serif font-bold mb-1 truncate ${trend.textColor}`}
                                    >
                                        {trend.title}
                                    </h4>
                                    <p 
                                      className={`text-xs uppercase tracking-wider opacity-75 ${trend.textColor}`}
                                    >
                                        {trend.subtitle}
                                    </p>
                                </div>
                                <span className="text-2xl sm:text-3xl ml-2">{trend.emoji}</span>
                            </div>
                            <p 
                              className={`text-sm mb-2 leading-tight opacity-80 ${trend.textColor}`}
                            >
                                {trend.desc}
                            </p>
                            {config.trend === trend.id && (
                                <div className={`flex items-center gap-1.5 text-xs font-semibold mt-auto ${trend.textColor}`}
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Выбрано
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        ))}

        {/* Creative Studio Section */}
        <div 
          className="mt-10 pt-8 animate-fade-in-up"
          style={{
            borderTop: '1px solid var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
            animationDelay: `${categories.length * 100}ms`,
          }}
        >
             <h3 
               className="text-lg font-semibold mb-6"
               style={{ color: 'var(--tg-theme-text-color, #000000)' }}
             >
                 Дополнительно
             </h3>
             
             <div className="grid grid-cols-2 gap-6">
                 {/* Custom Manual */}
                 <div 
                    onClick={handleCustom}
                    className="border-2 border-dashed border-brand-300 rounded-xl sm:rounded-2xl p-4 sm:p-6 cursor-pointer text-center hover:border-brand-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out min-h-[140px] sm:min-h-[160px] flex flex-col justify-center"
                    style={{
                      backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
                    }}
                >
                     <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">✍️</div>
                     <h4 
                       className="text-sm sm:text-base font-serif font-bold mb-1 sm:mb-2"
                       style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                     >
                         Твоя идея
                     </h4>
                     <p 
                       className="text-xs sm:text-sm leading-relaxed"
                       style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                     >
                         Напиши свой промпт. Мы выполним любую (безопасную) фантазию.
                     </p>
                 </div>

                 {/* I'm Feeling Lucky */}
                 <div 
                    onClick={!luckyLoading ? handleLucky : undefined}
                    className="border-2 border-brand-300 rounded-xl sm:rounded-2xl p-4 sm:p-6 cursor-pointer text-center hover:border-brand-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out min-h-[140px] sm:min-h-[160px] flex flex-col justify-center"
                    style={{
                      backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
                    }}
                >
                        {luckyLoading ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 border-4 border-brand-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
                                </div>
                                <span 
                                  className="text-sm text-brand-600 font-semibold"
                                >
                                    Генерирую идею...
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">✨</div>
                                <h4 
                                  className="text-sm sm:text-base font-serif font-bold mb-1 sm:mb-2"
                                  style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                                >
                                    Мне повезет!
                                </h4>
                                <p 
                                  className="text-xs sm:text-sm leading-relaxed whitespace-normal"
                                  style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                                >
                                    Нейросеть сама придумает уникальный концепт для тебя.
                                </p>
                            </>
                        )}
                 </div>
             </div>
        </div>
      </div>

      {!isTelegram && (
        <div className="mt-16 flex justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
          <Button variant="secondary" onClick={() => setStep(1)} className="px-8 hover:-translate-x-1">Назад</Button>
          {/* The 'Next' button is less critical now due to auto-advance but kept for accessibility */}
          <Button 
              disabled={!config.trend}
              onClick={() => setStep(3)} 
              className="px-10 py-4 text-lg shadow-brand-300 shadow-opacity-50 shadow-lg hover:scale-105 active:scale-95"
          >
              Настроить детали →
          </Button>
        </div>
      )}
    </div>
  );
};