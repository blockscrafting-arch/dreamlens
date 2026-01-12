import React, { useState, useRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading, 
  onClick,
  ...props 
}) => {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current && !isLoading) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipple({ x, y });
      setTimeout(() => setRipple(null), 600);
    }
    onClick?.(e);
  };

  const baseStyles = "relative px-6 py-3 rounded-full font-semibold transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 overflow-hidden";
  
  const variants = {
    primary: "bg-gradient-brand text-white shadow-glow-md hover:shadow-glow-lg hover:bg-gradient-brand-hover",
    secondary: "bg-white text-brand-600 border-2 border-brand-200 hover:border-brand-400 hover:bg-gradient-to-br hover:from-brand-50 hover:to-purple-50 shadow-soft hover:shadow-soft-md",
    outline: "border-2 border-brand-400 text-brand-600 hover:bg-gradient-to-br hover:from-brand-50 hover:to-purple-50 hover:border-brand-500 hover:shadow-glow-sm",
    ghost: "text-gray-500 hover:text-brand-600 hover:bg-gradient-to-br hover:from-gray-50 hover:to-brand-50"
  };

  return (
    <button 
      ref={buttonRef}
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      disabled={isLoading || props.disabled}
      onClick={handleClick}
      {...props}
    >
      {ripple && (
        <span
          className="absolute rounded-full bg-white opacity-30 animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '20px',
            height: '20px',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="animate-pulse">Обработка...</span>
        </>
      ) : children}
    </button>
  );
};