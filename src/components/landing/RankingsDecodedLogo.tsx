import React from 'react';

interface LogoProps {
  variant?: 'light' | 'dark' | 'gradient';
  showText?: boolean;
  size?: number;
  className?: string;
  textKicker?: string;
}

/**
 * Official Rankings Decoded Logomark & Lockup
 * Recreated with exact geometry from the October 2026 Brandbook:
 * Continuous dual-ribbon vortex loop (evoking 'R' and strategic clarity).
 */
export function RankingsDecodedMark({
  size = 36,
  variant = 'light',
  className = ''
}: {
  size?: number;
  variant?: 'light' | 'dark' | 'gradient';
  className?: string;
}) {
  const gradientId = `rd-mark-grad-${variant}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Rankings Decoded Logomark"
    >
      <defs>
        {/* Signature Brand Gradient: Royal Cobalt Blue to Vibrant Coral/Orange */}
        <linearGradient id={gradientId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1B44ED" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#FF5E36" />
        </linearGradient>

        <linearGradient id="rd-mark-light" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        <linearGradient id="rd-mark-blue" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1B44ED" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Outer Vortex Ribbon Upper Loop */}
      <path
        d="M24 6C33.941 6 42 14.059 42 24C42 29.5 39.5 34.5 35.5 37.8C33.9 39.1 31.5 38.2 31.8 36.1C32.1 34.2 32.3 32.2 32.3 30.2C32.3 22.8 28.2 16.5 22.2 13.5C20.2 12.5 19.8 9.8 21.5 8.2C22.3 7.4 23.1 6.7 24 6Z"
        fill={
          variant === 'light'
            ? 'url(#rd-mark-light)'
            : variant === 'gradient'
            ? `url(#${gradientId})`
            : 'url(#rd-mark-blue)'
        }
      />

      {/* Inner Vortex Ribbon Counter Loop */}
      <path
        d="M24 42C14.059 42 6 33.941 6 24C6 18.5 8.5 13.5 12.5 10.2C14.1 8.9 16.5 9.8 16.2 11.9C15.9 13.8 15.7 15.8 15.7 17.8C15.7 25.2 19.8 31.5 25.8 34.5C27.8 35.5 28.2 38.2 26.5 39.8C25.7 40.6 24.9 41.3 24 42Z"
        fill={
          variant === 'light'
            ? '#CBD5E1'
            : variant === 'gradient'
            ? '#FF5E36'
            : '#1B44ED'
        }
        fillOpacity={variant === 'light' ? 0.85 : 0.95}
      />

      {/* Central Core Dynamic Accent */}
      <circle
        cx="24"
        cy="24"
        r="3.5"
        fill={
          variant === 'light'
            ? '#FFFFFF'
            : variant === 'gradient'
            ? '#FF5E36'
            : '#1B44ED'
        }
      />
    </svg>
  );
}

export default function RankingsDecodedLogo({
  variant = 'dark',
  showText = true,
  size = 36,
  className = '',
  textKicker = 'Legal Market Intelligence, Strategy & Advisory'
}: LogoProps) {
  const isDarkBg = variant === 'light';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size > 32 ? '0.75rem' : '0.6rem',
        textDecoration: 'none'
      }}
      className={className}
    >
      {/* Logomark Badge */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: isDarkBg
            ? 'rgba(255, 255, 255, 0.08)'
            : 'linear-gradient(135deg, #090E17 0%, #1E293B 100%)',
          border: isDarkBg
            ? '1px solid rgba(255, 255, 255, 0.15)'
            : '1px solid rgba(15, 23, 42, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDarkBg
            ? '0 4px 12px rgba(0, 0, 0, 0.25)'
            : '0 2px 10px rgba(15, 23, 42, 0.1)',
          flexShrink: 0
        }}
      >
        <RankingsDecodedMark size={Math.round(size * 0.68)} variant={isDarkBg ? 'light' : 'gradient'} />
      </div>

      {/* Brand Text Lockup */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
          <span
            style={{
              fontSize: size > 32 ? '1.2rem' : '1.02rem',
              fontWeight: 700,
              color: isDarkBg ? '#F8FAFC' : '#0F172A',
              letterSpacing: '-0.025em',
              fontFamily: "'Neue Montreal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              whiteSpace: 'nowrap'
            }}
          >
            Rankings Decoded
          </span>
          {textKicker && (
            <span
              style={{
                fontSize: size > 32 ? '0.62rem' : '0.56rem',
                color: isDarkBg ? '#94A3B8' : '#64748B',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginTop: '0.18rem',
                whiteSpace: 'nowrap'
              }}
            >
              {textKicker}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
