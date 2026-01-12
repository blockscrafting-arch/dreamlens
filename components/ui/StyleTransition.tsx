import React, { useEffect, useState } from 'react';
import { TrendType } from '../../types';

interface StyleTransitionProps {
  trend: TrendType | null;
  isActive: boolean;
  onComplete: () => void;
}

// Snowflake component for A_LA_RUSSE
const Snowflakes: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(50)].map((_, i) => (
      <div
        key={i}
        className="absolute text-white opacity-80 animate-snowfall"
        style={{
          left: `${Math.random() * 100}%`,
          top: `-20px`,
          fontSize: `${8 + Math.random() * 16}px`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${2 + Math.random() * 3}s`,
        }}
      >
        ❄
      </div>
    ))}
  </div>
);

// Sparkles for MOB_WIFE / Y2K
const GoldSparkles: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(40)].map((_, i) => (
      <div
        key={i}
        className="absolute animate-sparkle-float"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 1.5}s`,
        }}
      >
        <span 
          className="text-yellow-400"
          style={{ fontSize: `${10 + Math.random() * 20}px` }}
        >
          ✦
        </span>
      </div>
    ))}
  </div>
);

// Digital particles for CYBER_ANGEL / NEON_CYBER
const DigitalParticles: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(60)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-digital-rise"
        style={{
          left: `${Math.random() * 100}%`,
          bottom: `-10px`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${1.5 + Math.random() * 2}s`,
          boxShadow: '0 0 10px #22d3ee, 0 0 20px #22d3ee',
        }}
      />
    ))}
    {[...Array(20)].map((_, i) => (
      <div
        key={`code-${i}`}
        className="absolute text-cyan-300 font-mono text-xs opacity-60 animate-digital-rise"
        style={{
          left: `${Math.random() * 100}%`,
          bottom: `-20px`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
        }}
      >
        {['0', '1', '◇', '△', '○'][Math.floor(Math.random() * 5)]}
      </div>
    ))}
  </div>
);

// Sun rays for TOMATO_GIRL / COTTAGECORE
const SunRays: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 w-2 h-48 bg-gradient-to-b from-amber-300/60 to-transparent origin-bottom animate-sun-ray"
          style={{
            transform: `translate(-50%, -100%) rotate(${i * 30}deg)`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
    {/* Floating particles */}
    {[...Array(20)].map((_, i) => (
      <div
        key={`dust-${i}`}
        className="absolute w-1 h-1 bg-amber-200 rounded-full animate-dust-float"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
        }}
      />
    ))}
  </div>
);

// Rose petals for COQUETTE
const RosePetals: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(30)].map((_, i) => (
      <div
        key={i}
        className="absolute animate-petal-fall"
        style={{
          left: `${Math.random() * 100}%`,
          top: `-30px`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${3 + Math.random() * 2}s`,
        }}
      >
        <span 
          className="text-pink-300 opacity-80"
          style={{ 
            fontSize: `${14 + Math.random() * 10}px`,
            transform: `rotate(${Math.random() * 360}deg)`,
            display: 'inline-block',
          }}
        >
          ❀
        </span>
      </div>
    ))}
  </div>
);

// Neon lights for COUPLE / RETRO
const NeonLights: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Bokeh circles */}
    {[...Array(25)].map((_, i) => {
      const colors = ['#ff6b9d', '#c084fc', '#60a5fa', '#f472b6'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return (
        <div
          key={i}
          className="absolute rounded-full animate-bokeh-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${20 + Math.random() * 60}px`,
            height: `${20 + Math.random() * 60}px`,
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      );
    })}
  </div>
);

// Leaves for COTTAGECORE
const FloatingLeaves: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute animate-leaf-fall"
        style={{
          left: `${Math.random() * 100}%`,
          top: `-30px`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${4 + Math.random() * 3}s`,
        }}
      >
        <span 
          className="text-green-600 opacity-70"
          style={{ fontSize: `${16 + Math.random() * 12}px` }}
        >
          {['🍃', '🌿', '🍂'][Math.floor(Math.random() * 3)]}
        </span>
      </div>
    ))}
  </div>
);

// Flash effect for RETRO_2K17 / Y2K
const CameraFlash: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute inset-0 bg-white animate-camera-flash" />
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="absolute bg-white rounded-full animate-flash-burst"
        style={{
          left: `${20 + Math.random() * 60}%`,
          top: `${20 + Math.random() * 60}%`,
          width: '4px',
          height: '4px',
          animationDelay: `${0.1 + i * 0.15}s`,
        }}
      />
    ))}
  </div>
);

// Candle flames for DARK_ACADEMIA
const CandleFlames: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="absolute bottom-0 flex flex-col items-center animate-candle-appear"
        style={{
          left: `${10 + i * 12}%`,
          animationDelay: `${i * 0.15}s`,
        }}
      >
        <div className="w-3 h-6 bg-gradient-to-t from-amber-500 via-orange-400 to-yellow-200 rounded-full animate-flame-flicker blur-[1px]" />
        <div className="w-1 h-8 bg-amber-100 rounded-b" />
      </div>
    ))}
    {/* Dust particles in light */}
    {[...Array(30)].map((_, i) => (
      <div
        key={`dust-${i}`}
        className="absolute w-0.5 h-0.5 bg-amber-200/60 rounded-full animate-dust-float"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
        }}
      />
    ))}
  </div>
);

// Ballet ribbons for BALLETCORE
const BalletRibbons: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="absolute w-4 h-32 bg-gradient-to-b from-pink-200 to-pink-100 rounded-full animate-ribbon-dance opacity-60"
        style={{
          left: `${15 + i * 15}%`,
          top: '20%',
          animationDelay: `${i * 0.2}s`,
          transformOrigin: 'top center',
        }}
      />
    ))}
  </div>
);

// Leopard spots for MOB_WIFE
const LeopardSpots: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(30)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-amber-800/40 animate-spot-appear"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${15 + Math.random() * 25}px`,
          height: `${10 + Math.random() * 20}px`,
          transform: `rotate(${Math.random() * 360}deg)`,
          animationDelay: `${Math.random() * 1}s`,
        }}
      />
    ))}
  </div>
);

// Glasses reflection for OFFICE_SIREN
const GlassesReflection: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
    <div className="relative animate-glasses-appear">
      {/* Glasses frame */}
      <div className="flex gap-4">
        <div className="w-20 h-12 border-2 border-slate-400 rounded-lg bg-slate-200/20 animate-lens-shine overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent animate-shine-sweep" />
        </div>
        <div className="w-20 h-12 border-2 border-slate-400 rounded-lg bg-slate-200/20 animate-lens-shine overflow-hidden" style={{ animationDelay: '0.3s' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent animate-shine-sweep" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
      {/* Bridge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-0.5 bg-slate-400" />
    </div>
  </div>
);

// Waves for COASTAL_COWGIRL
const OceanWaves: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="absolute w-full h-16 animate-wave"
        style={{
          bottom: `${i * 10}%`,
          animationDelay: `${i * 0.3}s`,
          opacity: 0.3 - i * 0.05,
        }}
      >
        <svg viewBox="0 0 1200 120" className="w-full h-full fill-cyan-400/30">
          <path d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z" />
        </svg>
      </div>
    ))}
  </div>
);

// Get animation component based on trend
const getAnimationForTrend = (trend: TrendType): React.ReactNode => {
  switch (trend) {
    case TrendType.A_LA_RUSSE:
      return <Snowflakes />;
    case TrendType.MOB_WIFE:
      return <><LeopardSpots /><GoldSparkles /></>;
    case TrendType.CYBER_ANGEL:
    case TrendType.NEON_CYBER:
      return <DigitalParticles />;
    case TrendType.TOMATO_GIRL:
      return <SunRays />;
    case TrendType.COQUETTE:
      return <RosePetals />;
    case TrendType.BALLETCORE:
      return <><RosePetals /><BalletRibbons /></>;
    case TrendType.COUPLE:
      return <NeonLights />;
    case TrendType.RETRO_2K17:
    case TrendType.Y2K_POP:
      return <><CameraFlash /><GoldSparkles /></>;
    case TrendType.DARK_ACADEMIA:
      return <CandleFlames />;
    case TrendType.COTTAGECORE:
      return <><FloatingLeaves /><SunRays /></>;
    case TrendType.OFFICE_SIREN:
      return <GlassesReflection />;
    case TrendType.COASTAL_COWGIRL:
      return <><OceanWaves /><SunRays /></>;
    case TrendType.OLD_MONEY:
    case TrendType.QUIET_LUXURY:
      return <GoldSparkles />;
    case TrendType.ETHEREAL:
      return <><DigitalParticles /><RosePetals /></>;
    case TrendType.CLEAN_GIRL:
      return <SunRays />;
    case TrendType.GRUNGE_REVIVAL:
    case TrendType.SOFT_GOTH:
      return <CandleFlames />;
    case TrendType.MAGAZINE:
    case TrendType.PROFESSIONAL:
      return <CameraFlash />;
    case TrendType.MINIMALIST:
      return <SunRays />;
    case TrendType.SPORT_CHIC:
      return <CameraFlash />;
    default:
      return <GoldSparkles />;
  }
};

// Get background color based on trend
const getBackgroundForTrend = (trend: TrendType): string => {
  switch (trend) {
    case TrendType.A_LA_RUSSE:
      return 'bg-gradient-to-br from-blue-900 via-slate-800 to-blue-950';
    case TrendType.MOB_WIFE:
      return 'bg-gradient-to-br from-amber-900 via-yellow-800 to-amber-950';
    case TrendType.CYBER_ANGEL:
      return 'bg-gradient-to-br from-white via-blue-50 to-purple-50';
    case TrendType.NEON_CYBER:
      return 'bg-gradient-to-br from-purple-900 via-fuchsia-900 to-indigo-950';
    case TrendType.TOMATO_GIRL:
      return 'bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-300';
    case TrendType.COQUETTE:
      return 'bg-gradient-to-br from-pink-200 via-rose-100 to-pink-100';
    case TrendType.BALLETCORE:
      return 'bg-gradient-to-br from-pink-100 via-rose-50 to-white';
    case TrendType.COUPLE:
      return 'bg-gradient-to-br from-rose-900 via-red-800 to-rose-950';
    case TrendType.RETRO_2K17:
      return 'bg-gradient-to-br from-indigo-900 via-purple-800 to-violet-900';
    case TrendType.Y2K_POP:
      return 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600';
    case TrendType.DARK_ACADEMIA:
      return 'bg-gradient-to-br from-stone-900 via-stone-800 to-black';
    case TrendType.COTTAGECORE:
      return 'bg-gradient-to-br from-green-200 via-lime-100 to-amber-100';
    case TrendType.OFFICE_SIREN:
      return 'bg-gradient-to-br from-slate-300 via-slate-200 to-slate-100';
    case TrendType.COASTAL_COWGIRL:
      return 'bg-gradient-to-br from-amber-200 via-orange-100 to-cyan-200';
    case TrendType.OLD_MONEY:
    case TrendType.QUIET_LUXURY:
      return 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100';
    case TrendType.ETHEREAL:
      return 'bg-gradient-to-br from-teal-200 via-emerald-100 to-cyan-100';
    case TrendType.SOFT_GOTH:
      return 'bg-gradient-to-br from-purple-900 via-gray-900 to-black';
    case TrendType.GRUNGE_REVIVAL:
      return 'bg-gradient-to-br from-stone-700 via-stone-600 to-stone-800';
    case TrendType.CLEAN_GIRL:
      return 'bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-50';
    case TrendType.SPORT_CHIC:
      return 'bg-gradient-to-br from-slate-200 via-gray-100 to-white';
    case TrendType.MAGAZINE:
      return 'bg-gradient-to-br from-gray-900 via-gray-800 to-black';
    case TrendType.PROFESSIONAL:
      return 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900';
    case TrendType.MINIMALIST:
      return 'bg-gradient-to-br from-stone-100 via-white to-stone-50';
    default:
      return 'bg-gradient-to-br from-brand-100 via-white to-purple-100';
  }
};

export const StyleTransition: React.FC<StyleTransitionProps> = ({ trend, isActive, onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive && trend) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 1500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [isActive, trend, onComplete]);

  if (!isVisible || !trend) return null;

  return (
    <div 
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        ${getBackgroundForTrend(trend)}
        animate-transition-overlay
      `}
    >
      {getAnimationForTrend(trend)}
      
      {/* Center text */}
      <div className="relative z-10 text-center animate-fade-in-up">
        <div className="text-6xl mb-4 animate-bounce">
          {getTrendEmoji(trend)}
        </div>
        <h2 className="text-2xl font-serif font-bold text-white drop-shadow-lg">
          {getTrendName(trend)}
        </h2>
      </div>
    </div>
  );
};

// Helper to get emoji for trend
const getTrendEmoji = (trend: TrendType): string => {
  const emojiMap: Partial<Record<TrendType, string>> = {
    [TrendType.A_LA_RUSSE]: '❄️',
    [TrendType.MOB_WIFE]: '🐆',
    [TrendType.OFFICE_SIREN]: '👓',
    [TrendType.TOMATO_GIRL]: '🍅',
    [TrendType.OLD_MONEY]: '🥂',
    [TrendType.QUIET_LUXURY]: '🤍',
    [TrendType.PROFESSIONAL]: '💼',
    [TrendType.COQUETTE]: '🎀',
    [TrendType.CLEAN_GIRL]: '✨',
    [TrendType.BALLETCORE]: '🩰',
    [TrendType.CYBER_ANGEL]: '🪽',
    [TrendType.NEON_CYBER]: '💿',
    [TrendType.COUPLE]: '🎬',
    [TrendType.RETRO_2K17]: '📼',
    [TrendType.DARK_ACADEMIA]: '📚',
    [TrendType.MAGAZINE]: '📸',
    [TrendType.SPORT_CHIC]: '🧢',
    [TrendType.Y2K_POP]: '💄',
    [TrendType.COASTAL_COWGIRL]: '🏖️',
    [TrendType.COTTAGECORE]: '🌻',
    [TrendType.ETHEREAL]: '🦋',
    [TrendType.MINIMALIST]: '☁️',
    [TrendType.SOFT_GOTH]: '🥀',
    [TrendType.GRUNGE_REVIVAL]: '🎸',
    [TrendType.CUSTOM]: '✨',
  };
  return emojiMap[trend] || '✨';
};

// Helper to get Russian name for trend
const getTrendName = (trend: TrendType): string => {
  const nameMap: Partial<Record<TrendType, string>> = {
    [TrendType.A_LA_RUSSE]: 'Русская Зима',
    [TrendType.MOB_WIFE]: 'Mob Wife',
    [TrendType.OFFICE_SIREN]: 'Office Siren',
    [TrendType.TOMATO_GIRL]: 'Italian Summer',
    [TrendType.OLD_MONEY]: 'Old Money',
    [TrendType.QUIET_LUXURY]: 'Quiet Luxury',
    [TrendType.PROFESSIONAL]: 'Forbes Style',
    [TrendType.COQUETTE]: 'Coquette',
    [TrendType.CLEAN_GIRL]: 'Clean Girl',
    [TrendType.BALLETCORE]: 'Balletcore',
    [TrendType.CYBER_ANGEL]: 'Cyber Angel',
    [TrendType.NEON_CYBER]: 'Cyberpunk',
    [TrendType.COUPLE]: 'Cinema Night',
    [TrendType.RETRO_2K17]: 'Indie Sleaze',
    [TrendType.DARK_ACADEMIA]: 'Dark Academia',
    [TrendType.MAGAZINE]: 'Editorial',
    [TrendType.SPORT_CHIC]: 'Off-Duty Model',
    [TrendType.Y2K_POP]: 'Y2K Pop',
    [TrendType.COASTAL_COWGIRL]: 'Coastal Cowgirl',
    [TrendType.COTTAGECORE]: 'Cottagecore',
    [TrendType.ETHEREAL]: 'Fantasy',
    [TrendType.MINIMALIST]: 'Minimal',
    [TrendType.SOFT_GOTH]: 'Soft Goth',
    [TrendType.GRUNGE_REVIVAL]: 'Grunge Revival',
    [TrendType.CUSTOM]: 'Custom Style',
  };
  return nameMap[trend] || 'Style';
};

export default StyleTransition;
