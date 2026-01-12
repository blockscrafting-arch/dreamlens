/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./api/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        brand: {
          50: '#fff0f7',
          100: '#ffe4f0',
          200: '#fecddf',
          300: '#fea3c6',
          400: '#fc6da6',
          500: '#f53e86',
          600: '#e31c65',
          700: '#c91a5a',
          750: '#b8174f',
          800: '#9d174d',
          900: '#831843',
          950: '#701a3a',
        },
        cream: '#FFFCF8',
        accent: {
          purple: {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
            800: '#6b21a8',
            900: '#581c87',
          },
          blue: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },
          gold: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
        },
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.05em' }],
        'sm': ['0.875rem', { lineHeight: '1.6', letterSpacing: '0.025em' }],
        'base': ['1rem', { lineHeight: '1.75', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.75', letterSpacing: '-0.025em' }],
        'xl': ['1.25rem', { lineHeight: '1.75', letterSpacing: '-0.025em' }],
        '2xl': ['1.5rem', { lineHeight: '1.4', letterSpacing: '-0.05em' }],
        '3xl': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.05em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.05em' }],
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.05em' }],
        '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.05em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
        '160': '40rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-md': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 8px 16px -4px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 8px 30px -4px rgba(0, 0, 0, 0.1), 0 12px 24px -6px rgba(0, 0, 0, 0.06)',
        'glow-sm': '0 0 10px rgba(245, 62, 134, 0.3)',
        'glow-md': '0 0 20px rgba(245, 62, 134, 0.4)',
        'glow-lg': '0 0 30px rgba(245, 62, 134, 0.5)',
        'glow-xl': '0 0 40px rgba(245, 62, 134, 0.6)',
        'glow-2xl': '0 0 60px rgba(245, 62, 134, 0.7)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.4)',
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.4)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.4)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
        'glass-xl': '0 12px 40px 0 rgba(31, 38, 135, 0.6)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'premium': '0 20px 60px -12px rgba(245, 62, 134, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'pop-in': 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in': 'slideIn 0.5s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'spin-slow': 'spin 8s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'ripple': 'ripple 0.6s cubic-bezier(0.2, 0, 0.2, 1)',
        'smooth-scale': 'smoothScale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in': 'fadeIn 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'confetti-burst': 'confettiBurst 0.6s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'countdown-tick': 'countdownTick 1s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.9' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        smoothScale: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        confettiBurst: {
          '0%': { 
            opacity: '1', 
            transform: 'translate(-50%, -50%) rotate(0deg) translateY(0)' 
          },
          '100%': { 
            opacity: '0', 
            transform: 'translate(-50%, -50%) rotate(var(--angle, 0deg)) translateY(var(--distance, 50px))' 
          },
        },
        glowPulse: {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(245, 62, 134, 0.3), 0 0 10px rgba(245, 62, 134, 0.2)' 
          },
          '50%': { 
            boxShadow: '0 0 15px rgba(245, 62, 134, 0.5), 0 0 30px rgba(245, 62, 134, 0.3)' 
          },
        },
        countdownTick: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(5deg)' },
        },
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #f53e86 0%, #e31c65 25%, #c91a5a 50%, #9333ea 75%, #7e22ce 100%)',
        'gradient-brand': 'linear-gradient(135deg, #fc6da6 0%, #f53e86 50%, #e31c65 100%)',
        'gradient-brand-hover': 'linear-gradient(135deg, #f53e86 0%, #e31c65 50%, #c91a5a 100%)',
        'gradient-accent': 'linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #f59e0b 100%)',
        'gradient-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
        'gradient-radial': 'radial-gradient(circle, rgba(245, 62, 134, 0.1) 0%, transparent 70%)',
        'gradient-mesh': 'radial-gradient(at 0% 0%, rgba(245, 62, 134, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(245, 158, 11, 0.15) 0px, transparent 50%)',
      },
    }
  },
  plugins: [],
}

