import React from 'react';

export const MinistryLogo: React.FC<{ className?: string; variant?: 'badge' | 'full' }> = ({
  className = 'h-14 sm:h-16 md:h-18',
  variant = 'badge',
}) => {
  return (
    <div className={`inline-flex items-center gap-4 sm:gap-6 select-none ${className}`}>
      <img
        src="/logo.png"
        alt="شعار وزارة التعليم"
        className="h-full w-auto object-contain transition-all duration-200 drop-shadow-md ml-1 sm:ml-2"
        style={{ maxHeight: '100%', minHeight: '48px' }}
      />
      {variant === 'full' && (
        <div className="text-right leading-tight hidden sm:block">
          <div className="text-[10px] font-extrabold text-emerald-400 tracking-wider">
            المملكة العربية السعودية • وزارة التعليم
          </div>
          <div className="text-xs font-black text-white">
            الإدارة العامة للتعليم بمنطقة المدينة المنورة
          </div>
        </div>
      )}
    </div>
  );
};
