import React from 'react';

export const Separator: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div className={`shrink-0 bg-border h-[1px] w-full ${className}`} {...props} />
  );
};