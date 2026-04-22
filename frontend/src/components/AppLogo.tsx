import type { HTMLAttributes } from 'react';
import { brand } from '../brand';

interface AppLogoProps extends HTMLAttributes<HTMLSpanElement> {
  compact?: boolean;
  tone?: 'brand' | 'mono';
}

export function AppLogo({ compact = false, tone = 'brand', className = '', ...props }: AppLogoProps) {
  const markId = tone === 'mono' ? 'mahlio-logo-mono' : 'mahlio-logo-fill';
  const stroke = tone === 'mono' ? 'currentColor' : '#0d8a63';
  const tomato = tone === 'mono' ? 'currentColor' : '#df6a46';
  const lemon = tone === 'mono' ? 'currentColor' : '#f2c76e';
  return (
    <span
      className={`app-logo app-logo-tone-${tone}${compact ? ' app-logo-compact' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <svg className="app-logo-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="7" y="7" width="50" height="50" rx="18" fill={`url(#${markId})`} />
        <circle cx="32" cy="32" r="16" fill="rgba(255,255,255,0.92)" />
        <path d="M18 32c2.5-4.6 7.5-7.4 14-7.4S43.5 27.4 46 32" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="24" cy="36.5" r="2.6" fill={tomato} />
        <circle cx="32" cy="39" r="2.6" fill={stroke} />
        <circle cx="40" cy="36.5" r="2.6" fill={lemon} />
        <defs>
          <linearGradient id="mahlio-logo-fill" x1="12" y1="10" x2="55" y2="55" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0d8a63" />
            <stop offset="1" stopColor="#56b68b" />
          </linearGradient>
          <linearGradient id="mahlio-logo-mono" x1="12" y1="10" x2="55" y2="55" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" />
          </linearGradient>
        </defs>
      </svg>
      {compact ? <span className="app-logo-wordmark">{brand.name}</span> : (
        <span className="app-logo-type">
          <strong>{brand.name}</strong>
          <small>{brand.slogan}</small>
        </span>
      )}
    </span>
  );
}
