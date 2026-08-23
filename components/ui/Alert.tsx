import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={`relative w-full rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800 ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => {
  return (
    <p className={`text-sm [&_p]:leading-relaxed ${className}`} {...props} />
  );
};