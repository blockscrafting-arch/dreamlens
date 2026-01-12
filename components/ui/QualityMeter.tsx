import React from 'react';

interface QualityMeterProps {
    count: number;
    averageScore: number;
    readiness: number;
}

export const QualityMeter: React.FC<QualityMeterProps> = ({ count, averageScore, readiness }) => {
    // Determine color based on readiness with premium gradients
    let progressGradient = 'bg-gradient-to-r from-red-400 to-red-600';
    let glowClass = 'shadow-glow-sm';
    let label = 'Мало данных';
    let textColor = 'text-red-500';
    let percentageColor = 'text-red-600';

    if (readiness >= 80) {
        progressGradient = 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600';
        glowClass = 'shadow-glow-green';
        label = 'Отлично! Готовы творить 💎';
        textColor = 'text-green-600';
        percentageColor = 'text-green-600';
    } else if (readiness >= 40) {
        progressGradient = 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600';
        glowClass = 'shadow-glow-gold';
        label = 'Хорошо, но лучше еще парочку';
        textColor = 'text-yellow-600';
        percentageColor = 'text-yellow-600';
    }

    // New target is 5-8
    const target = 5;

    return (
        <div 
          className="rounded-2xl p-6 shadow-soft-lg border w-full mb-8 hover:shadow-premium transition-all duration-300"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
            borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
          }}
        >
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 
                      className="text-lg font-bold text-shadow-soft"
                      style={{ color: 'var(--tg-theme-text-color, #000000)' }}
                    >
                      Готовность модели
                    </h3>
                    <p className={`text-sm font-medium ${textColor} mt-1`}>{label}</p>
                </div>
                <div className="text-right">
                    <span className={`text-3xl font-bold ${percentageColor} text-shadow-soft animate-glow`}>
                        {readiness}%
                    </span>
                </div>
            </div>

            {/* Premium Progress Bar with Glow */}
            <div 
              className="h-5 rounded-full overflow-hidden mb-6 relative backdrop-blur-sm"
              style={{
                backgroundColor: 'var(--tg-theme-bg-color, rgba(0, 0, 0, 0.05))',
              }}
            >
                <div 
                    className={`h-full ${progressGradient} transition-all duration-700 ease-out relative ${glowClass} ${readiness >= 80 ? 'animate-glow' : ''}`}
                    style={{ width: `${readiness}%` }}
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-shimmer opacity-30 animate-shimmer"></div>
                </div>
                {/* Premium Markers */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/60 left-[50%] shadow-sm"></div>
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/60 left-[80%] shadow-sm"></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div 
                  className="p-4 rounded-xl border hover:border-brand-200/50 transition-all"
                  style={{
                    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                    borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
                  }}
                >
                    <span 
                      className="block mb-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                    >
                      Количество
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-xl ${count >= 5 ? 'text-green-600' : 'text-brand-600'} text-shadow-soft`}>
                            {count} <span 
                              className="text-sm font-normal"
                              style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                            >
                              / {target}+
                            </span>
                        </span>
                    </div>
                </div>

                <div 
                  className="p-4 rounded-xl border hover:border-brand-200/50 transition-all"
                  style={{
                    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                    borderColor: 'var(--tg-theme-section-separator-color, rgba(0, 0, 0, 0.1))',
                  }}
                >
                    <span 
                      className="block mb-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--tg-theme-hint-color, #999999)' }}
                    >
                      Качество фото
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-xl ${averageScore > 75 ? 'text-green-600' : 'text-brand-600'} text-shadow-soft`}>
                            {Math.round(averageScore)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};