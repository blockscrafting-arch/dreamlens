import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { TrendType } from '../../types';
import { Button } from '../ui/Button';
import { rateLimiter } from '../../utils/rateLimit';
import { apiRequest } from '../../lib/api';
import { useTelegramMainButton, useTelegramHaptics } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';
import { StyleTransition } from '../ui/StyleTransition';

// Style card component with enhanced animations
interface StyleCardProps {
  trend: {
    id: TrendType;
    title: string;
    subtitle: string;
    desc: string;
    emoji: string;
    tags: string[];
    gradient: string;
    textColor: string;
    isHot?: boolean;
  };
  isSelected: boolean;
  onClick: () => void;
  animationDelay: number;
}

const StyleCard: React.FC<StyleCardProps> = ({ trend, isSelected, onClick, animationDelay }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    setShowConfetti(true);
    onClick();
    // Reset confetti after animation
    setTimeout(() => setShowConfetti(false), 600);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-5 cursor-pointer 
        transition-all duration-300 ease-out h-44 sm:h-52 flex flex-col justify-between 
        animate-fade-in-up group
        ${trend.gradient}
        ${isSelected 
          ? 'ring-2 ring-white/60 shadow-xl scale-[1.02] z-10' 
          : 'hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]'
        }
      `}
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Shimmer overlay for hot items */}
      {trend.isHot && !isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
      )}

      {/* Hover glow effect */}
      <div 
        className={`
          absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none
          ${isHovered && !isSelected ? 'opacity-100' : ''}
        `}
        style={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Selection pulse effect */}
      {isSelected && (
        <div className="absolute inset-0 animate-pulse-slow bg-white/5 pointer-events-none" />
      )}

      {/* Confetti particles on selection */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-confetti-burst"
              style={{
                backgroundColor: ['#fff', '#ffd700', '#ff69b4', '#00ff88'][i % 4],
                left: '50%',
                top: '50%',
                '--angle': `${i * 45}deg`,
                '--distance': `${40 + Math.random() * 30}px`,
                animationDelay: `${i * 30}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Card content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className={`text-sm sm:text-lg font-serif font-bold mb-1 truncate ${trend.textColor}`}>
              {trend.title}
            </h4>
            <p className={`text-xs uppercase tracking-wider opacity-75 ${trend.textColor}`}>
              {trend.subtitle}
            </p>
          </div>
          <span 
            className={`
              text-2xl sm:text-3xl ml-2 transition-transform duration-300
              ${isHovered ? 'scale-110 rotate-12' : ''}
              ${isSelected ? 'animate-bounce' : ''}
            `}
          >
            {trend.emoji}
          </span>
        </div>
        
        <p className={`text-xs sm:text-sm mb-2 leading-tight opacity-80 ${trend.textColor}`}>
          {trend.desc}
        </p>
      </div>

      {/* Tags section */}
      <div className="relative z-10 mt-auto">
        {isSelected ? (
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${trend.textColor}`}>
            <svg className="w-4 h-4 animate-pop-in" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Выбрано
          </div>
        ) : (
          <div className={`
            flex flex-wrap gap-1 transition-all duration-300
            ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-60 translate-y-1'}
          `}>
            {trend.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className={`
                  text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full 
                  bg-white/20 backdrop-blur-sm ${trend.textColor}
                  transition-all duration-200
                `}
                style={{
                  transitionDelay: `${idx * 50}ms`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hot badge */}
      {trend.isHot && (
        <div className="absolute -top-1 -right-1 w-16 h-16 overflow-hidden">
          <div className="absolute top-3 -right-4 w-20 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[8px] font-bold py-0.5 text-center transform rotate-45 shadow-sm">
            HOT
          </div>
        </div>
      )}
    </div>
  );
};

export const TrendStep: React.FC = () => {
  const { config, updateConfig, setStep } = useWizard();
  const { showToast } = useToast();
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [transitionTrend, setTransitionTrend] = useState<TrendType | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTelegram = isTelegramWebApp();
  const { show: showMainButton, hide: hideMainButton } = useTelegramMainButton();
  const { impactOccurred } = useTelegramHaptics();

  // Handle transition animation completion
  const handleTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    setTransitionTrend(null);
    setStep(3);
  }, [setStep]);

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
      // Trigger haptic feedback
      if (isTelegram) {
        impactOccurred('medium');
      }
      // Start transition animation
      setTransitionTrend(trendId);
      setIsTransitioning(true);
  };

  // Trends with tags and visual properties - updated for 2025
  const trends = {
    // ===== HOT TRENDS 2025 =====
    [TrendType.A_LA_RUSSE]: {
      id: TrendType.A_LA_RUSSE,
      title: "A LA RUSSE",
      subtitle: "Imperial",
      desc: "Зимняя аристократия и русская роскошь",
      emoji: "❄️",
      tags: ["Мех", "Холод", "Величие"],
      gradient: "bg-gradient-to-br from-red-800 via-red-900 to-black text-white",
      textColor: "text-white",
      isHot: true,
    },
    [TrendType.MOB_WIFE]: {
      id: TrendType.MOB_WIFE,
      title: "MOB WIFE",
      subtitle: "Jersey Luxe",
      desc: "Леопард, золото, большие волосы",
      emoji: "🐆",
      tags: ["Flashy", "90s", "Attitude"],
      gradient: "bg-gradient-to-br from-yellow-700 via-yellow-800 to-amber-900 text-amber-50",
      textColor: "text-amber-50",
      isHot: true,
    },
    [TrendType.OFFICE_SIREN]: {
      id: TrendType.OFFICE_SIREN,
      title: "SIREN",
      subtitle: "Dangerous Mind",
      desc: "Очки, пучок и опасная энергия",
      emoji: "👓",
      tags: ["Власть", "Интеллект", "Miu Miu"],
      gradient: "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-slate-900",
      textColor: "text-slate-900",
      isHot: true,
    },
    [TrendType.TOMATO_GIRL]: {
      id: TrendType.TOMATO_GIRL,
      title: "TOMATO",
      subtitle: "Italian Summer",
      desc: "Амальфи, солнце, терракота",
      emoji: "🍅",
      tags: ["Загар", "Лён", "La Dolce Vita"],
      gradient: "bg-gradient-to-br from-orange-400 via-red-400 to-orange-500 text-white",
      textColor: "text-white",
      isHot: true,
    },
    
    // ===== LUXURY & STATUS =====
    [TrendType.OLD_MONEY]: {
      id: TrendType.OLD_MONEY,
      title: "HERITAGE",
      subtitle: "Old Money",
      desc: "Тихая роскошь без логотипов",
      emoji: "🥂",
      tags: ["Кашемир", "Lake Como", "Элегантность"],
      gradient: "bg-gradient-to-br from-orange-50 via-amber-100 to-amber-200 text-amber-900",
      textColor: "text-amber-900",
      isHot: false,
    },
    [TrendType.QUIET_LUXURY]: {
      id: TrendType.QUIET_LUXURY,
      title: "THE ROW",
      subtitle: "Quiet Luxury",
      desc: "Минимализм за миллион",
      emoji: "🤍",
      tags: ["Bottega", "Brunello", "Stealth"],
      gradient: "bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300 text-stone-800 border border-stone-300",
      textColor: "text-stone-800",
      isHot: false,
    },
    [TrendType.PROFESSIONAL]: {
      id: TrendType.PROFESSIONAL,
      title: "FORBES",
      subtitle: "CEO Energy",
      desc: "Визионер и лидер поколения",
      emoji: "💼",
      tags: ["Rembrandt", "Authority", "Vision"],
      gradient: "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 text-white",
      textColor: "text-white",
      isHot: false,
    },
    
    // ===== MODERN FEMININE =====
    [TrendType.COQUETTE]: {
      id: TrendType.COQUETTE,
      title: "COQUETTE",
      subtitle: "Sofia Coppola",
      desc: "Банты, шёлк и романтика",
      emoji: "🎀",
      tags: ["Дымка", "Пастель", "Мечты"],
      gradient: "bg-gradient-to-br from-pink-200 via-rose-200 to-pink-300 text-rose-900",
      textColor: "text-rose-900",
      isHot: false,
    },
    [TrendType.CLEAN_GIRL]: {
      id: TrendType.CLEAN_GIRL,
      title: "CLEAN",
      subtitle: "Glossier Era",
      desc: "Сияющая кожа и wellness",
      emoji: "✨",
      tags: ["Dewy", "Minimal", "Rhode"],
      gradient: "bg-gradient-to-br from-white via-rose-50 to-pink-50 text-gray-800 border border-pink-200",
      textColor: "text-gray-800",
      isHot: false,
    },
    [TrendType.BALLETCORE]: {
      id: TrendType.BALLETCORE,
      title: "PRIMA",
      subtitle: "Balletcore",
      desc: "Грация и дисциплина балета",
      emoji: "🩰",
      tags: ["Tulle", "Grace", "Black Swan"],
      gradient: "bg-gradient-to-br from-pink-100 via-rose-100 to-pink-200 text-rose-900",
      textColor: "text-rose-900",
      isHot: false,
    },
    
    // ===== DIGITAL & FUTURE =====
    [TrendType.CYBER_ANGEL]: {
      id: TrendType.CYBER_ANGEL,
      title: "ANGEL",
      subtitle: "Digital Divinity",
      desc: "Цифровое божество и halo",
      emoji: "🪽",
      tags: ["Hologram", "Glass Skin", "Y3K"],
      gradient: "bg-gradient-to-br from-blue-50 via-white to-blue-100 text-blue-900 border border-blue-200",
      textColor: "text-blue-900",
      isHot: false,
    },
    [TrendType.NEON_CYBER]: {
      id: TrendType.NEON_CYBER,
      title: "CHROME",
      subtitle: "Blade Runner",
      desc: "Жидкий металл и неон",
      emoji: "💿",
      tags: ["Liquid", "Reflections", "2077"],
      gradient: "bg-gradient-to-br from-fuchsia-700 via-purple-800 to-indigo-900 text-white",
      textColor: "text-white",
      isHot: false,
    },
    
    // ===== CINEMA & ATMOSPHERE =====
    [TrendType.COUPLE]: {
      id: TrendType.COUPLE,
      title: "CINEMA",
      subtitle: "Wong Kar-wai",
      desc: "2AM такси и огни города",
      emoji: "🎬",
      tags: ["Боке", "Неон", "Романтика"],
      gradient: "bg-gradient-to-br from-rose-500 via-red-600 to-rose-700 text-white",
      textColor: "text-white",
      isHot: false,
    },
    [TrendType.RETRO_2K17]: {
      id: TrendType.RETRO_2K17,
      title: "INDIE",
      subtitle: "Party Era",
      desc: "Вспышка, 3AM, chaos glam",
      emoji: "📼",
      tags: ["Flash", "Grain", "Mess"],
      gradient: "bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white",
      textColor: "text-white",
      isHot: false,
    },
    [TrendType.DARK_ACADEMIA]: {
      id: TrendType.DARK_ACADEMIA,
      title: "SCHOLAR",
      subtitle: "Secret Society",
      desc: "Библиотеки и тайные знания",
      emoji: "📚",
      tags: ["Свечи", "Tweed", "Mystery"],
      gradient: "bg-gradient-to-br from-stone-800 via-stone-900 to-black text-stone-200",
      textColor: "text-stone-200",
      isHot: false,
    },
    [TrendType.MAGAZINE]: {
      id: TrendType.MAGAZINE,
      title: "DAZED",
      subtitle: "High Fashion",
      desc: "Авангард и дерзкий editorial",
      emoji: "📸",
      tags: ["Harsh Flash", "Angles", "Art"],
      gradient: "bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white",
      textColor: "text-white",
      isHot: false,
    },
    
    // ===== LIFESTYLE & VIBE =====
    [TrendType.SPORT_CHIC]: {
      id: TrendType.SPORT_CHIC,
      title: "OFF-DUTY",
      subtitle: "Princess Diana",
      desc: "Athleisure и папарацци",
      emoji: "🧢",
      tags: ["Bike Shorts", "Royalty", "Candid"],
      gradient: "bg-gradient-to-br from-emerald-600 via-green-700 to-emerald-800 text-white",
      textColor: "text-white",
      isHot: false,
    },
    [TrendType.Y2K_POP]: {
      id: TrendType.Y2K_POP,
      title: "2000s",
      subtitle: "Paris & Britney",
      desc: "Стразы, low-rise и блеск",
      emoji: "💄",
      tags: ["Rhinestone", "Pink", "Icon"],
      gradient: "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white",
      textColor: "text-white",
      isHot: false,
    },
    [TrendType.COASTAL_COWGIRL]: {
      id: TrendType.COASTAL_COWGIRL,
      title: "COASTAL",
      subtitle: "Beach Meets Ranch",
      desc: "Ковбойки и океан",
      emoji: "🤠",
      tags: ["Boho", "Sunset", "Freedom"],
      gradient: "bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200 text-amber-900",
      textColor: "text-amber-900",
      isHot: false,
    },
    [TrendType.COTTAGECORE]: {
      id: TrendType.COTTAGECORE,
      title: "PASTORAL",
      subtitle: "Pride & Prejudice",
      desc: "Лён, луга и золотой час",
      emoji: "🌻",
      tags: ["Golden Hour", "Film", "Nature"],
      gradient: "bg-gradient-to-br from-lime-200 via-green-200 to-green-300 text-green-900",
      textColor: "text-green-900",
      isHot: false,
    },
    
    // ===== ART & FANTASY =====
    [TrendType.ETHEREAL]: {
      id: TrendType.ETHEREAL,
      title: "ELVEN",
      subtitle: "High Fantasy",
      desc: "Эльфийская королева и магия",
      emoji: "🦋",
      tags: ["Glow", "Particles", "Pearl"],
      gradient: "bg-gradient-to-br from-teal-200 via-emerald-200 to-teal-300 text-teal-900",
      textColor: "text-teal-900",
      isHot: false,
    },
    [TrendType.MINIMALIST]: {
      id: TrendType.MINIMALIST,
      title: "PURE",
      subtitle: "Khaite Vibes",
      desc: "Честная красота без фильтров",
      emoji: "☁️",
      tags: ["Real Skin", "Studio", "Quiet"],
      gradient: "bg-gradient-to-br from-white via-gray-100 to-gray-200 text-gray-800 border border-gray-200",
      textColor: "text-gray-800",
      isHot: false,
    },
    [TrendType.SOFT_GOTH]: {
      id: TrendType.SOFT_GOTH,
      title: "GOTHIC",
      subtitle: "Romantic Dark",
      desc: "Чёрный бархат и увядшие розы",
      emoji: "🥀",
      tags: ["Velvet", "Candles", "Moody"],
      gradient: "bg-gradient-to-br from-purple-900 via-gray-900 to-black text-purple-200",
      textColor: "text-purple-200",
      isHot: false,
    },
    [TrendType.GRUNGE_REVIVAL]: {
      id: TrendType.GRUNGE_REVIVAL,
      title: "GRUNGE",
      subtitle: "90s Seattle",
      desc: "Фланель, мешковатость и raw",
      emoji: "🎸",
      tags: ["Messy", "Anti-Fashion", "Real"],
      gradient: "bg-gradient-to-br from-stone-600 via-stone-700 to-stone-800 text-stone-200",
      textColor: "text-stone-200",
      isHot: false,
    },
  };

  const categories = [
    {
      title: "🔥 Горячие тренды 2025",
      items: [trends[TrendType.A_LA_RUSSE], trends[TrendType.MOB_WIFE], trends[TrendType.OFFICE_SIREN], trends[TrendType.TOMATO_GIRL]]
    },
    {
      title: "💎 Роскошь и статус",
      items: [trends[TrendType.OLD_MONEY], trends[TrendType.QUIET_LUXURY], trends[TrendType.PROFESSIONAL]]
    },
    {
      title: "🎀 Feminine Energy",
      items: [trends[TrendType.COQUETTE], trends[TrendType.CLEAN_GIRL], trends[TrendType.BALLETCORE]]
    },
    {
      title: "🤖 Цифровое будущее",
      items: [trends[TrendType.CYBER_ANGEL], trends[TrendType.NEON_CYBER]]
    },
    {
      title: "🎬 Кино и атмосфера",
      items: [trends[TrendType.COUPLE], trends[TrendType.RETRO_2K17], trends[TrendType.DARK_ACADEMIA], trends[TrendType.MAGAZINE]]
    },
    {
      title: "☀️ Lifestyle",
      items: [trends[TrendType.SPORT_CHIC], trends[TrendType.Y2K_POP], trends[TrendType.COASTAL_COWGIRL], trends[TrendType.COTTAGECORE]]
    },
    {
      title: "🦋 Арт и фантазии",
      items: [trends[TrendType.ETHEREAL], trends[TrendType.MINIMALIST], trends[TrendType.SOFT_GOTH], trends[TrendType.GRUNGE_REVIVAL]]
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
                        <StyleCard
                            key={trend.id}
                            trend={trend}
                            isSelected={config.trend === trend.id}
                            onClick={() => handleSelectTrend(trend.id)}
                            animationDelay={(catIdx * 100) + (itemIdx * 50)}
                        />
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

      {/* Style Transition Animation Overlay */}
      <StyleTransition 
        trend={transitionTrend}
        isActive={isTransitioning}
        onComplete={handleTransitionComplete}
      />
    </div>
  );
};