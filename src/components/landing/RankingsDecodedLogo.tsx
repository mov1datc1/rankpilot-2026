import React from 'react';
import Image from 'next/image';

interface LogoProps {
  variant?: 'light' | 'dark' | 'gradient';
  showText?: boolean;
  size?: number;
  className?: string;
  textKicker?: string;
  useImageOnly?: boolean;
}

/**
 * Official Rankings Decoded Logomark (Oleh's 2026 Brand Identity)
 * Features the signature 3-blade dynamic aerodynamic vortex
 * transitioning from Baby Blue Ice (#87BFFF) through Royal Cobalt (#1B44ED)
 * to Deep Navy (#000073).
 */
export function RankingsDecodedMark({
  size = 36,
  variant = 'gradient',
  className = ''
}: {
  size?: number;
  variant?: 'light' | 'dark' | 'gradient';
  className?: string;
}) {
  const isLight = variant === 'light';

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      className={className}
    >
      {/* High-res image rendered from Figma with crisp scaling */}
      <img
        src={isLight ? '/brand/rankings_decoded_logomark_white.png' : '/brand/rankings_decoded_logomark.png'}
        alt="Rankings Decoded"
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
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
      {/* Logomark */}
      <RankingsDecodedMark
        size={size}
        variant={isDarkBg ? 'light' : 'gradient'}
      />

      {/* Brand Text Lockup matching Oleh's Figma wordmark */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.35rem',
              letterSpacing: '-0.025em',
              fontFamily: "'Nexa', 'Neue Montreal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <span
              style={{
                fontSize: size > 32 ? '1.24rem' : '1.05rem',
                fontWeight: 500,
                color: isDarkBg ? '#FFFFFF' : '#000073'
              }}
            >
              Rankings
            </span>
            <span
              style={{
                fontSize: size > 32 ? '1.24rem' : '1.05rem',
                fontWeight: 800,
                color: isDarkBg ? '#FFFFFF' : '#000073'
              }}
            >
              Decoded
            </span>
          </div>

          {textKicker && (
            <span
              style={{
                fontSize: size > 32 ? '0.62rem' : '0.54rem',
                color: isDarkBg ? '#87BFFF' : '#475569',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginTop: '0.2rem',
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
