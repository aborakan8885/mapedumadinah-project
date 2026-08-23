import React from 'react';

interface MinistryLogoProps {
  className?: string;
  variant?: string;
}

export const MinistryLogo: React.FC<MinistryLogoProps> = ({
  className = "",
}) => {
  return (
    <div 
      className={`shrink-0 ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '8px 12px',
        height: '74px',
        width: 'auto',
        transition: 'all 0.3s ease'
      }}
    >
      <img 
        src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCI+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjAwLCAxNDApIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4KICAgIDxnIGZpbGw9IiMwMEE4ODciPgogICAgICA8Y2lyY2xlIGN4PSItMTEwIiBjeT0iLTYwIiByPSI5LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ii0xMTAiIGN5PSItMzQiIHI9IjkuNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iLTExMCIgY3k9Ii04IiByPSI5LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ii04MiIgY3k9Ii01MiIgcj0iOSIgLz4KICAgICAgPGNpcmNsZSBjeD0iLTgyIiBjeT0iLTI4IiByPSI5IiAvPgogICAgICA8Y2lyY2xlIGN4PSItODIiIGN5PSItNCIgcj0iOSIgLz4KICAgICAgPGNpcmNsZSBjeD0iLTU1IiBjeT0iLTQyIiByPSI4IiAvPgogICAgICA8Y2lyY2xlIGN4PSItNTUiIGN5PSItMjAiIHI9IjgiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ii0zMCIgY3k9Ii0zMiIgcj0iNyIgLz4KICAgICAgPGNpcmNsZSBjeD0iMCIgY3k9Ii0yMCIgcj0iNiIgLz4KICAgICAgPGNpcmNsZSBjeD0iMzAiIGN5PSItMzIiIHI9IjciIC8+CiAgICAgIDxjaXJjbGUgY3g9IjU1IiBjeT0iLTQyIiByPSI4IiAvPgogICAgICA8Y2lyY2xlIGN4PSI1NSIgY3k9Ii0yMCIgcj0iOCIgLz4KICAgICAgPGNpcmNsZSBjeD0iODIiIGN5PSItNTIiIHI9IjkiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ijg2IiBjeT0iLTI4IiByPSI5IiAvPgogICAgICA8Y2lyY2xlIGN4PSI4MiIgY3k9Ii00IiByPSI5IiAvPgogICAgICA8Y2lyY2xlIGN4PSIxMTAiIGN5PSItNjAiIHI9IjkuNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iMTEwIiBjeT0iLTM0IiByPSI5LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9IjExMCIgY3k9Ii04IiByPSI5LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ii05NSIgY3k9IjE4IiByPSI3LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9Ii02OCIgY3k9IjI0IiByPSI3IiAvPgogICAgICA8Y2lyY2xlIGN4PSItNDIiIGN5PSIyOCIgcj0iNi41IiAvPgogICAgICA8Y2lyY2xlIGN4PSItMTgiIGN5PSIzMCIgcj0iNiIgLz4KICAgICAgPGNpcmNsZSBjeD0iMTgiIGN5PSIzMCIgcj0iNiIgLz4KICAgICAgPGNpcmNsZSBjeD0iNDIiIGN5PSIyOCIgcj0iNi41IiAvPgogICAgICA8Y2lyY2xlIGN4PSI2OCIgY3k9IjI0IiByPSI3IiAvPgogICAgICA8Y2lyY2xlIGN4PSI5NSIgY3k9IjE4IiByPSI3LjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9IjAiIGN5PSIzOCIgcj0iNSIgLz4KICAgIDwvZz4KICAgIDx0ZXh0IHk9IjExNSIgZm9udC1mYW1pbHk9IidUYWphd2FsJywgJ0NhaXJvJywgJ0FsbWFyYWknLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSI0NCIgZmlsbD0iIzAwQTg4NyIgbGV0dGVyLXNwYWNpbmc9IjAiPtmI2LLYp9ix2Kkg2KfZhNiq2YDYudmA2YTZgNmK2YDZhTwvdGV4dD4KICAgIDx0ZXh0IHk9IjE1NSIgZm9udC1mYW1pbHk9IidUYWphd2FsJywgJ0ludGVyJywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI2MDAiIGZvbnQtc2l6ZT0iMjIiIGZpbGw9IiM4RDk4QTAiIGxldHRlci1zcGFjaW5nPSIwLjUiPk1pbmlzdHJ5IG9mIEVkdWNhdGlvbjwvdGV4dD4KICA8L2c+Cjwvc3ZnPg==" 
        alt="وزارة التعليم" 
        style={{
          height: '60px',
          width: 'auto',
          aspectRatio: '1 / 1',
          objectFit: 'contain',
          background: 'transparent',
        }}
        className="transform-none select-none pointer-events-none"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
