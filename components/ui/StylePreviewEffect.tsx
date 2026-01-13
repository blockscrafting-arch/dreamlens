import React, { useMemo } from 'react';
import { TrendType } from '../../types';

// Яркие эффекты для превью карточек стилей

const Snowflakes: React.FC = () => {
  const flakes = useMemo(() => 
    [...Array(25)].map((_, i) => ({
      left: `${(i * 4) % 100}%`,
      fontSize: `${10 + (i % 4) * 4}px`,
      delay: `${(i % 5) * 0.2}s`,
      duration: `${1.5 + (i % 3) * 0.5}s`,
    })), []
  );
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flakes.map((flake, i) => (
        <div
          key={i}
          className="absolute text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-snowfall"
          style={{
            left: flake.left,
            top: `-20px`,
            fontSize: flake.fontSize,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
};

const Sparkles: React.FC = () => {
  const sparkles = useMemo(() => 
    [...Array(30)].map((_, i) => ({
      left: `${(i * 13) % 100}%`,
      top: `${(i * 17) % 100}%`,
      size: `${12 + (i % 4) * 5}px`,
      delay: `${(i % 6) * 0.15}s`,
    })), []
  );
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {sparkles.map((s, i) => (
        <div
          key={i}
          className="absolute animate-sparkle-float"
          style={{
            left: s.left,
            top: s.top,
            animationDelay: s.delay,
          }}
        >
          <span
            className="text-yellow-300 drop-shadow-[0_0_8px_rgba(255,215,0,0.9)]"
            style={{ fontSize: s.size }}
          >
            {i % 3 === 0 ? '✦' : i % 3 === 1 ? '✧' : '⋆'}
          </span>
        </div>
      ))}
    </div>
  );
};

const NeonBokeh: React.FC = () => {
  const circles = useMemo(() => {
    const colors = ['#ff6b9d', '#c084fc', '#60a5fa', '#f472b6', '#a855f7'];
    return [...Array(20)].map((_, i) => ({
      left: `${(i * 17) % 100}%`,
      top: `${(i * 23) % 100}%`,
      size: `${20 + (i % 5) * 15}px`,
      color: colors[i % colors.length],
      delay: `${(i % 4) * 0.3}s`,
    }));
  }, []);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {circles.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-bokeh-pulse"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            height: c.size,
            background: `radial-gradient(circle, ${c.color}70 0%, ${c.color}30 40%, transparent 70%)`,
            boxShadow: `0 0 20px ${c.color}50`,
            animationDelay: c.delay,
          }}
        />
      ))}
    </div>
  );
};

const LightDust: React.FC = () => {
  const particles = useMemo(() => 
    [...Array(25)].map((_, i) => ({
      left: `${(i * 19) % 100}%`,
      top: `${(i * 23) % 100}%`,
      size: `${3 + (i % 3) * 2}px`,
      delay: `${(i % 5) * 0.25}s`,
    })), []
  );
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-dust-float"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.4) 100%)',
            boxShadow: '0 0 8px rgba(251,191,36,0.6)',
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
};

const Ribbon: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="absolute w-4 h-28 bg-gradient-to-b from-pink-300 to-pink-100 rounded-full animate-ribbon-dance"
        style={{
          left: `${10 + i * 14}%`,
          top: '10%',
          animationDelay: `${i * 0.1}s`,
          transformOrigin: 'top center',
          boxShadow: '0 0 12px rgba(236,72,153,0.4)',
        }}
      />
    ))}
  </div>
);

type EffectMap = Partial<Record<TrendType, React.ReactNode>>;

const effectMap: EffectMap = {
  [TrendType.A_LA_RUSSE]: <Snowflakes />,
  [TrendType.MOB_WIFE]: <Sparkles />,
  [TrendType.CYBER_ANGEL]: <NeonBokeh />,
  [TrendType.NEON_CYBER]: <NeonBokeh />,
  [TrendType.TOMATO_GIRL]: <LightDust />,
  [TrendType.COQUETTE]: <Ribbon />,
  [TrendType.BALLETCORE]: <Ribbon />,
  [TrendType.COUPLE]: <NeonBokeh />,
  [TrendType.RETRO_2K17]: <Sparkles />,
  [TrendType.Y2K_POP]: <Sparkles />,
  [TrendType.DARK_ACADEMIA]: <LightDust />,
  [TrendType.COTTAGECORE]: <LightDust />,
  [TrendType.OLD_MONEY]: <Sparkles />,
  [TrendType.QUIET_LUXURY]: <Sparkles />,
  [TrendType.ETHEREAL]: <LightDust />,
  [TrendType.MINIMALIST]: <LightDust />,
  [TrendType.SOFT_GOTH]: <LightDust />,
  [TrendType.GRUNGE_REVIVAL]: <LightDust />,
  [TrendType.MAGAZINE]: <Sparkles />,
  [TrendType.PROFESSIONAL]: <LightDust />,
  [TrendType.SPORT_CHIC]: <Sparkles />,
  [TrendType.COASTAL_COWGIRL]: <LightDust />,
};

interface StylePreviewEffectProps {
  trend: TrendType;
  active: boolean;
}

const StylePreviewEffect: React.FC<StylePreviewEffectProps> = ({ trend, active }) => {
  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {effectMap[trend] || <Sparkles />}
    </div>
  );
};

export default StylePreviewEffect;

