import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  size = 'md', 
  variant = 'primary', 
  ...props 
}) => {
  const sizeClasses = {
    sm: 'min-h-[36px] sm:min-h-[38px] px-3 py-1.5 rounded-lg text-fluid-xs sm:text-xs',
    md: 'min-h-[44px] sm:min-h-[42px] px-4 py-2 rounded-xl text-fluid-sm sm:text-sm',
    lg: 'min-h-[48px] sm:min-h-[48px] px-6 py-2.5 rounded-xl text-fluid-base sm:text-base font-bold',
  };

  const variantClasses = {
    primary: 'bg-primary-light text-slate-950 font-bold hover:bg-primary-hover shadow-sm active:scale-[0.98]',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 shadow-sm active:scale-[0.98]',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm active:scale-[0.98]',
    outline: 'bg-transparent border-2 border-primary-light text-primary-light hover:bg-primary-light/10 font-bold'
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

