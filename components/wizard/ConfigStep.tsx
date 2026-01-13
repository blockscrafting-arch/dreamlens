import React, { useState, useEffect, useRef } from 'react';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { AspectRatio, ImageQuality, TrendType } from '../../types';
import { Button } from '../ui/Button';
import { sanitizePrompt, validateFileSize, validateImageType } from '../../utils/validation';
import { rateLimiter } from '../../utils/rateLimit';
import { apiRequest } from '../../lib/api';
import { useTelegramMainButton, useTelegramHaptics } from '../../hooks/useTelegram';
import { isTelegramWebApp } from '../../lib/telegram';
import { getBatchTokenCost, getBatchDiscount, MIN_BATCH_SIZE, MAX_BATCH_SIZE } from '../../shared/constants';

// Mapping for display purposes
const STYLE_INFO: Record<TrendType, { title: string; desc: string; emoji: string; gradient: string }> = {
    [TrendType.MAGAZINE]: { title: "DAZED", desc: "Авангард и высокая мода", emoji: "📸", gradient: "from-gray-800 to-black" },
    [TrendType.PROFESSIONAL]: { title: "CEO", desc: "Деловой портрет", emoji: "💼", gradient: "from-gray-700 to-gray-900" },
    [TrendType.COUPLE]: { title: "CINEMA", desc: "Любовное настроение", emoji: "🎬", gradient: "from-rose-500 to-rose-700" },
    [TrendType.RETRO_2K17]: { title: "INDIE SLEAZE", desc: "Вечеринка и вспышка", emoji: "📼", gradient: "from-indigo-600 to-violet-700" },
    [TrendType.DARK_ACADEMIA]: { title: "DARK ACADEMIA", desc: "Готика и книги", emoji: "📚", gradient: "from-stone-800 to-black" },
    [TrendType.OLD_MONEY]: { title: "OLD MONEY", desc: "Тихая роскошь", emoji: "🥂", gradient: "from-amber-100 to-amber-300" },
    [TrendType.MOB_WIFE]: { title: "MOB WIFE", desc: "Гламур 90-х и меха", emoji: "🐆", gradient: "from-yellow-700 to-amber-900" },
    [TrendType.A_LA_RUSSE]: { title: "A LA RUSSE", desc: "Имперская роскошь и зима", emoji: "❄️", gradient: "from-red-800 to-red-900" },
    [TrendType.OFFICE_SIREN]: { title: "OFFICE SIREN", desc: "Строгий шик", emoji: "👓", gradient: "from-slate-400 to-slate-600" },
    [TrendType.COQUETTE]: { title: "COQUETTE", desc: "Романтика и пастель", emoji: "🎀", gradient: "from-pink-200 to-pink-300" },
    [TrendType.CLEAN_GIRL]: { title: "CLEAN GIRL", desc: "Естественность и кожа", emoji: "☁️", gradient: "from-gray-100 to-gray-300" },
    [TrendType.CYBER_ANGEL]: { title: "ANGEL Y3K", desc: "Цифровая дива", emoji: "🪽", gradient: "from-blue-100 to-blue-300" },
    [TrendType.NEON_CYBER]: { title: "LIQUID CHROME", desc: "Киберпанк", emoji: "💿", gradient: "from-fuchsia-700 to-indigo-900" },
    [TrendType.SPORT_CHIC]: { title: "OFF-DUTY", desc: "Спорт-шик и папарацци", emoji: "🧢", gradient: "from-emerald-600 to-emerald-800" },
    [TrendType.Y2K_POP]: { title: "2000s ICON", desc: "Гламур нулевых", emoji: "💄", gradient: "from-pink-500 to-purple-600" },
    [TrendType.COTTAGECORE]: { title: "COTTAGECORE", desc: "Природа и винтаж", emoji: "🌻", gradient: "from-lime-200 to-green-300" },
    [TrendType.ETHEREAL]: { title: "FANTASY", desc: "Эльфийская сказка", emoji: "🦋", gradient: "from-teal-200 to-teal-400" },
    [TrendType.MINIMALIST]: { title: "MINIMAL", desc: "Чистые линии", emoji: "◻️", gradient: "from-slate-100 to-slate-200" },
    [TrendType.TOMATO_GIRL]: { title: "TOMATO GIRL", desc: "Итальянское лето", emoji: "🍅", gradient: "from-red-400 to-orange-500" },
    [TrendType.COASTAL_COWGIRL]: { title: "COASTAL COWGIRL", desc: "Пляж и вестерн", emoji: "🤠", gradient: "from-amber-200 to-cyan-300" },
    [TrendType.QUIET_LUXURY]: { title: "QUIET LUXURY", desc: "Неброская роскошь", emoji: "🤍", gradient: "from-stone-200 to-stone-400" },
    [TrendType.BALLETCORE]: { title: "BALLETCORE", desc: "Грация балерины", emoji: "🩰", gradient: "from-pink-100 to-rose-200" },
    [TrendType.GRUNGE_REVIVAL]: { title: "GRUNGE REVIVAL", desc: "90-е возвращаются", emoji: "🎸", gradient: "from-stone-700 to-stone-900" },
    [TrendType.SOFT_GOTH]: { title: "SOFT GOTH", desc: "Мягкая готика", emoji: "🖤", gradient: "from-purple-900 to-black" },
    [TrendType.CUSTOM]: { title: "ТВОЯ ИДЕЯ", desc: "Авторский стиль", emoji: "✨", gradient: "from-violet-500 to-fuchsia-500" },
};

export const ConfigStep: React.FC = () => {
  const { config, updateConfig, setStep } = useWizard();
  const { showToast } = useToast();
  const [loadingIdea, setLoadingIdea] = useState(false);
  const refImageUrlRef = useRef<string | null>(null);
  const isTelegram = isTelegramWebApp();
  const { show: showMainButton, hide: hideMainButton, setLoading: setMainButtonLoading } = useTelegramMainButton();
  const { impactOccurred } = useTelegramHaptics();

  // Debug environment
  useEffect(() => {
    console.log('[ConfigStep] Environment check:', {
      isTelegram,
      hasTrend: !!config.trend,
      trend: config.trend,
      quality: config.quality,
      imageCount: config.imageCount
    });
  }, [isTelegram, config.trend, config.quality, config.imageCount]);
  
  // Cleanup reference image ObjectURL
  useEffect(() => {
    return () => {
      if (refImageUrlRef.current) {
        URL.revokeObjectURL(refImageUrlRef.current);
        refImageUrlRef.current = null;
      }
    };
  }, []);
  
  // Cleanup when reference image changes
  useEffect(() => {
    if (!config.referenceImage && refImageUrlRef.current) {
      URL.revokeObjectURL(refImageUrlRef.current);
      refImageUrlRef.current = null;
    }
  }, [config.referenceImage]);

  // Map enum to slider values
  const qualityLevels = [ImageQuality.STD, ImageQuality.HD, ImageQuality.UHD];
  const qualityLabels = [
      { label: 'Web', sub: 'Соцсети (1K)' },
      { label: 'Print', sub: 'Печать (2K)' },
      { label: 'Cinema', sub: 'Ultra HD (4K)' }
  ];
  const currentQualityIndex = qualityLevels.indexOf(config.quality);

  const activeStyle = STYLE_INFO[config.trend] || STYLE_INFO[TrendType.CUSTOM];

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value);
      updateConfig({ quality: qualityLevels[idx] });
  };

  const colors = [
    { name: 'Peach', hex: '#FFDAB9', value: 'peach, soft pastel' },
    { name: 'Cyber', hex: '#FF00FF', value: 'neon, cyberpunk' },
    { name: 'Noir', hex: '#222222', value: 'black and white, noir' },
    { name: 'Gold', hex: '#FFD700', value: 'golden hour, warm' },
    { name: 'Steel', hex: '#708090', value: 'cool tones, cinematic blue' },
    { name: 'Mint', hex: '#98FF98', value: 'fresh mint, nature' },
    { name: 'Red Velvet', hex: '#C41E3A', value: 'deep red, velvet, passion' },
    { name: 'Royal', hex: '#4169E1', value: 'royal blue, luxury' },
    { name: 'Lavender', hex: '#E6E6FA', value: 'soft lavender, dreamy' },
    { name: 'Emerald', hex: '#50C878', value: 'emerald green, elegant' },
    { name: 'Coral', hex: '#FF7F50', value: 'living coral, energetic' },
    { name: 'Mocha', hex: '#967969', value: 'brown, beige, mocha, warm earth' },
    { name: 'Clean White', hex: '#F5F5F5', value: 'minimal white, high key' },
    { name: 'Hot Pink', hex: '#FF69B4', value: 'vivid pink, barbie core' },
    { name: 'Electric', hex: '#00FFFF', value: 'electric blue, cyan, futuristic' },
    { name: 'Silver', hex: '#C0C0C0', value: 'silver, metallic, chrome' },
    { name: 'Chocolate', hex: '#D2691E', value: 'warm chocolate, cozy' },
  ];

  const ratios = [
      { id: AspectRatio.SQUARE, label: '1:1', css: 'w-10 h-10', desc: 'Пост' },
      { id: AspectRatio.PORTRAIT, label: '3:4', css: 'w-9 h-12', desc: 'Портрет' },
      { id: AspectRatio.STORY, label: '9:16', css: 'w-7 h-12', desc: 'Stories' },
      { id: AspectRatio.CINEMATIC, label: '16:9', css: 'w-14 h-8', desc: 'Кино' },
  ];

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate reference image
    if (!validateImageType(file)) {
      showToast('Неподдерживаемый формат изображения. Используйте JPEG, PNG, WebP или GIF.', 'error');
      e.target.value = ''; // Reset input
      return;
    }
    
    if (!validateFileSize(file, 10)) {
      showToast('Размер файла превышает 10MB. Пожалуйста, выберите файл меньшего размера.', 'error');
      e.target.value = ''; // Reset input
      return;
    }
    
    updateConfig({ referenceImage: file });
  };

  const removeRef = () => {
      // Cleanup ObjectURL before removing
      if (refImageUrlRef.current) {
        URL.revokeObjectURL(refImageUrlRef.current);
        refImageUrlRef.current = null;
      }
      updateConfig({ referenceImage: undefined });
  };

  const handleLuckyIdea = async () => {
    // Check rate limit
    const rateLimitCheck = rateLimiter.canMakeRequest();
    if (!rateLimitCheck.allowed) {
      showToast(rateLimitCheck.reason || 'Превышен лимит запросов. Подождите немного.', 'error');
      return;
    }

    setLoadingIdea(true);
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
            updateConfig({ userPrompt: creativePrompt });
          } else {
            throw new Error('Server did not return idea');
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
    } catch (e) {
        console.error(e);
        // Fallback to default prompt
        updateConfig({ userPrompt: "Девушка-киборг в неоновом Токио" });
    } finally {
        setLoadingIdea(false);
    }
  };

  // Setup Telegram MainButton
  useEffect(() => {
    if (!isTelegram) return;

    if (!loadingIdea) {
      showMainButton('📸 Создать шедевр', () => {
        impactOccurred('medium');
        setStep(4);
      }, true);
    } else {
      setMainButtonLoading(true);
    }

    return () => {
      hideMainButton();
      setMainButtonLoading(false);
    };
  }, [loadingIdea, isTelegram, showMainButton, hideMainButton, setMainButtonLoading, setStep, impactOccurred]);

  // Note: Telegram BackButton is managed centrally in App.tsx to avoid conflicts

  return (
    <div className="animate-fade-in-up">
      {/* Back button for web - positioned at top left */}
      {!isTelegram && (
        <button
          onClick={() => setStep(2)}
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
          <span className="font-medium">Назад к стилям</span>
        </button>
      )}
      
      <div className="text-center mb-8">
        <h2 
          className="text-4xl font-serif font-bold mb-3 text-shadow-soft"
          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          Тонкая настройка
        </h2>
        <p 
          className="text-lg leading-relaxed"
          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
        >
          Зададим технические параметры для идеального кадра.
        </p>
      </div>

        <div 
          className="max-w-3xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] shadow-premium border"
          style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
        }}
      >
        
        {/* Premium Selected Style Card */}
        <div className={`
            relative overflow-hidden rounded-2xl p-6 text-white shadow-premium flex items-center justify-between
            bg-gradient-to-r ${activeStyle.gradient}
        `}>
            <div className="absolute inset-0 bg-gradient-mesh opacity-20"></div>
            <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1 text-shadow-soft">Выбранный стиль</p>
                <h3 className="text-3xl font-serif font-bold leading-none text-shadow-premium">{activeStyle.title}</h3>
                <p className="text-sm opacity-90 mt-1 text-shadow-soft">{activeStyle.desc}</p>
            </div>
            <div className="text-5xl relative z-10 filter drop-shadow-2xl animate-float">
                {activeStyle.emoji}
            </div>
            {/* Premium Edit Button */}
            <button 
                onClick={() => setStep(2)}
                className="absolute top-4 right-4 text-xs font-bold glass-md bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-full transition-all z-20 cursor-pointer hover:scale-110 shadow-glow-sm"
            >
                Изменить
            </button>
        </div>

        {/* Custom Prompt Input (Only if Custom Trend) */}
        {config.trend === TrendType.CUSTOM && (
          <div className="space-y-3 pt-4">
            <div className="flex justify-between items-center">
                <label 
                  className="font-bold text-lg"
                  style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                >
                  Твоя идея
                </label>
                <button 
                    onClick={handleLuckyIdea} 
                    disabled={loadingIdea}
                    className="flex items-center gap-2 text-sm text-brand-500 font-bold hover:text-brand-600 transition-colors bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100"
                >
                    {loadingIdea ? (
                        <>
                           <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           Думаю...
                        </>
                    ) : (
                        <>✨ Мне повезет (AI)</>
                    )}
                </button>
            </div>
            
            <div className="relative">
                <textarea
                className="w-full p-4 border-2 border-brand-200/50 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-400 outline-none resize-none transition-all min-h-[120px]"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                  color: 'var(--tg-theme-text-color, #000000)',
                }}
                rows={4}
                placeholder="Опиши детально, что хочешь увидеть (одежда, локация, поза)..."
                value={config.userPrompt || ''}
                onChange={(e) => {
                  const sanitized = sanitizePrompt(e.target.value);
                  updateConfig({ userPrompt: sanitized });
                }}
                disabled={loadingIdea}
                maxLength={1000}
                />
                {loadingIdea && (
                    <div className="absolute inset-0 glass-lg rounded-2xl flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-brand-500 font-medium animate-pulse text-shadow-soft">Генерирую идею...</span>
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 pt-4">
            {/* Aspect Ratio */}
            <div className="space-y-3">
                <label 
                  className="block font-bold text-lg"
                  style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                >
                  Формат кадра
                </label>
                <div className="flex gap-3">
                    {ratios.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => updateConfig({ ratio: r.id })}
                        className={`flex flex-col items-center gap-2 group outline-none`}
                    >
                        <div className={`
                            ${r.css} border-2 rounded-md transition-all duration-300 ease-out
                            ${config.ratio === r.id 
                                ? 'border-brand-500 bg-gradient-brand shadow-glow-md scale-110' 
                                : 'border-gray-300 glass-sm group-hover:border-brand-300 group-hover:glass-md group-hover:scale-105 active:scale-95'
                            }
                        `}></div>
                        <span 
                          className={`text-[10px] uppercase font-bold transition-colors duration-300 ease-out ${config.ratio === r.id ? 'text-brand-600 text-shadow-soft' : ''}`}
                          style={config.ratio !== r.id ? { color: 'var(--tg-theme-hint-color, #999999)' } : {}}
                        >
                            {r.desc}
                        </span>
                    </button>
                    ))}
                </div>
            </div>

            {/* SMOOTH Quality Slider */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label 
                      className="font-bold text-lg"
                      style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                    >
                      Детализация
                    </label>
                    <span className="text-brand-600 font-bold bg-brand-50 px-3 py-1 rounded-full text-xs shadow-sm border border-brand-100">
                        {config.quality === ImageQuality.UHD ? 'Cinema 4K' : config.quality === ImageQuality.HD ? 'Full HD' : 'Standard'}
                    </span>
                </div>
                
                <div className="relative pt-4 pb-2 px-1">
                     {/* Custom Styled Slider */}
                     <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="1"
                        value={currentQualityIndex}
                        onChange={handleQualityChange}
                        className="w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer focus:outline-none
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-brand-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                        [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-brand-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg
                        "
                     />
                     
                     {/* Markers / Labels */}
                     <div className="flex justify-between mt-4">
                         {qualityLabels.map((q, idx) => (
                             <div 
                                key={idx} 
                                onClick={() => updateConfig({ quality: qualityLevels[idx] })}
                                className={`flex flex-col items-center cursor-pointer transition-opacity ${currentQualityIndex === idx ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                             >
                                 <div className={`w-1 h-2 mb-2 rounded-full ${currentQualityIndex === idx ? 'bg-brand-500 h-3' : 'bg-gray-300'}`}></div>
                                 <span 
                                   className="text-xs font-bold uppercase tracking-wide"
                                   style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                                 >
                                   {q.label}
                                 </span>
                                 <span 
                                   className="text-[10px]"
                                   style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                                 >
                                   {q.sub}
                                 </span>
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        </div>

        {/* Image Count Selector */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <label 
              className="font-bold text-lg"
              style={{ color: 'var(--tg-theme-text-color, #000000)' }}
            >
              Количество вариантов
            </label>
            {config.imageCount > 1 && (
              <span className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full text-xs shadow-sm border border-green-100">
                Скидка {getBatchDiscount(config.imageCount)}%
              </span>
            )}
          </div>
          
          <div className="flex gap-2 sm:gap-3">
            {Array.from({ length: MAX_BATCH_SIZE - MIN_BATCH_SIZE + 1 }, (_, i) => i + MIN_BATCH_SIZE).map((count) => {
              const isSelected = config.imageCount === count;
              const discount = getBatchDiscount(count);
              const cost = getBatchTokenCost(config.quality, count);
              
              return (
                <button
                  key={count}
                  onClick={() => updateConfig({ imageCount: count })}
                  className={`
                    relative flex flex-col items-center justify-center min-w-[48px] sm:min-w-[56px] py-2 sm:py-3 px-2 sm:px-3 rounded-xl border-2 transition-all duration-300 ease-out
                    ${isSelected 
                      ? 'border-brand-500 bg-gradient-to-b from-brand-50 to-brand-100 shadow-glow-md scale-105' 
                      : 'border-gray-200 hover:border-brand-300 hover:shadow-soft active:scale-95'
                    }
                  `}
                  style={{
                    backgroundColor: isSelected ? undefined : 'var(--tg-theme-bg-color, #ffffff)',
                  }}
                >
                  <span 
                    className={`text-lg sm:text-xl font-bold ${isSelected ? 'text-brand-600' : ''}`}
                    style={!isSelected ? { color: 'var(--tg-theme-text-color, #000000)' } : {}}
                  >
                    {count}
                  </span>
                  {discount > 0 && (
                    <span className="text-[9px] sm:text-[10px] text-green-600 font-semibold mt-0.5">
                      -{discount}%
                    </span>
                  )}
                  <span 
                    className="text-[9px] sm:text-[10px] mt-0.5 font-medium"
                    style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                  >
                    {cost} ток.
                  </span>
                </button>
              );
            })}
          </div>
          
          <p 
            className="text-xs leading-relaxed"
            style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
          >
            Больше вариантов — больше шансов найти идеальный кадр!
          </p>
        </div>

        <hr className="border-gray-100 my-2" />

        {/* Premium Reference Image Upload */}
        <div 
          className="p-6 rounded-2xl border-2 border-brand-200/30"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(245, 62, 134, 0.05))',
          }}
        >
             <div className="flex justify-between items-center mb-4">
                 <label 
                   className="block font-bold text-xl text-shadow-soft"
                   style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                 >
                    Референс (Поза / Стиль)
                 </label>
                 {config.referenceImage && (
                     <button onClick={removeRef} className="text-red-500 text-sm hover:text-red-600 font-semibold hover:scale-110 transition-all">
                         🗑 Удалить
                     </button>
                 )}
             </div>
             
             <p 
               className="text-sm mb-4 leading-relaxed"
               style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
             >
                 Загрузи фото, чтобы скопировать позу или атмосферу.
             </p>

             <div 
                className={`
                relative border-2 border-dashed rounded-xl p-6 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group
                ${config.referenceImage 
                    ? 'border-brand-500 ring-4 ring-brand-100 shadow-glow-md' 
                    : 'border-brand-200/50 hover:border-brand-400 hover:shadow-soft-md'
                }
             `}
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                }}
             >
                 <input type="file" onChange={handleRefUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" accept="image/*" />
                 
                 {config.referenceImage ? (
                     <div className="relative w-full flex flex-col items-center">
                         <div className="w-full h-48 rounded-lg overflow-hidden shadow-premium border border-white/30 mb-3 relative z-10 glass-sm">
                            {(() => {
                              // Create ObjectURL only once and reuse it
                              if (!refImageUrlRef.current) {
                                refImageUrlRef.current = URL.createObjectURL(config.referenceImage);
                              }
                              return (
                                <img 
                                  src={refImageUrlRef.current} 
                                  className="w-full h-full object-contain" 
                                  alt="ref" 
                                />
                              );
                            })()}
                         </div>
                         <div className="flex items-center gap-2 text-green-600 font-bold glass-sm bg-green-50/50 px-4 py-2 rounded-full shadow-glow-green">
                             <span>✓ Референс загружен</span>
                         </div>
                     </div>
                 ) : (
                     <div className="text-center py-4">
                        <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform duration-300 animate-float">🖼️</span>
                        <h4 
                          className="font-bold group-hover:text-brand-600 transition-colors text-shadow-soft"
                          style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                        >
                          Нажми, чтобы добавить
                        </h4>
                        <span 
                          className="text-xs"
                          style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                        >
                          или перетащи фото
                        </span>
                     </div>
                 )}
             </div>
        </div>

        {/* Color Palette */}
        <div className="space-y-3 pt-2">
          <label 
            className="block font-bold text-lg"
            style={{ color: 'var(--tg-theme-text-color, #000000)' }}
          >
              Цветовой акцент
          </label>
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center md:justify-start">
             <button
                onClick={() => updateConfig({ dominantColor: undefined })}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ease-out ${
                    !config.dominantColor ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200 hover:border-gray-400 active:scale-95'
                }`}
                title="Оригинальные цвета"
             >
                 <span className="text-gray-400 text-base sm:text-lg">✕</span>
             </button>

            {colors.map((c) => (
              <button
                key={c.name}
                onClick={() => updateConfig({ dominantColor: c.value })}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-soft transition-all transform duration-300 ease-out ${
                  config.dominantColor === c.value
                    ? 'scale-110 ring-2 ring-offset-2 ring-brand-400 shadow-glow-md' 
                    : 'hover:scale-105 hover:shadow-soft-md hover:ring-1 hover:ring-white/50 active:scale-95'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

      </div>

      {!isTelegram && (
        <div className="mt-10 flex justify-center gap-4">
          <Button variant="secondary" onClick={() => setStep(2)} className="px-6">Назад</Button>
          <Button onClick={() => setStep(4)} className="px-12 py-4 text-lg shadow-xl shadow-brand-400 shadow-opacity-40 hover:shadow-brand-500 hover:shadow-opacity-50">
              📸 Создать шедевр
          </Button>
        </div>
      )}
    </div>
  );
};