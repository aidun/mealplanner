import type { HTMLAttributes } from 'react';

interface AppLogoProps extends HTMLAttributes<HTMLSpanElement> {
  compact?: boolean;
}

export function AppLogo({ compact = false, className = '', ...props }: AppLogoProps) {
  return (
    <span className={`app-logo${compact ? ' app-logo-compact' : ''}${className ? ` ${className}` : ''}`} {...props}>
      <svg className="app-logo-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="7" y="7" width="50" height="50" rx="18" fill="url(#mealplanner-logo-fill)" />
        <circle cx="32" cy="32" r="16" fill="rgba(255,255,255,0.92)" />
        <path d="M18 32c2.5-4.6 7.5-7.4 14-7.4S43.5 27.4 46 32" stroke="#0d8a63" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="24" cy="36.5" r="2.6" fill="#df6a46" />
        <circle cx="32" cy="39" r="2.6" fill="#0d8a63" />
        <circle cx="40" cy="36.5" r="2.6" fill="#f2c76e" />
        <defs>
          <linearGradient id="mealplanner-logo-fill" x1="12" y1="10" x2="55" y2="55" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0d8a63" />
            <stop offset="1" stopColor="#56b68b" />
          </linearGradient>
        </defs>
      </svg>
      {!compact ? (
        <span className="app-logo-type">
          <strong>Familienkueche</strong>
          <small>Mealplanner</small>
        </span>
      ) : null}
    </span>
  );
}
