import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  interactive = false,
  ...props 
}) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm p-4 transition-all duration-200 ${
        interactive ? 'hover:shadow-md hover:border-slate-300 cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
