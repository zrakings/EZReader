import { Link } from 'react-router-dom'
import { useI18n } from '../../hooks/useAppStore'

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ez-gradient)" />
        <rect x="9" y="11" width="15" height="2.4" rx="1.2" fill="#0b1315" opacity="0.9" />
        <rect x="9" y="18.5" width="20" height="2.4" rx="1.2" fill="#0b1315" opacity="0.9" />
        <rect x="9" y="26" width="12" height="2.4" rx="1.2" fill="#0b1315" opacity="0.9" />
        <path d="M27 8.5 33 15l-6 6.5" stroke="#0b1315" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        <defs>
          <linearGradient id="ez-gradient" x1="5" y1="3" x2="35" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a3f0d4" />
            <stop offset="0.55" stopColor="#72d8c0" />
            <stop offset="1" stopColor="#4db8a8" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <Link to="/" className="brand" aria-label={`EZReader — ${t('app.tagline')}`}>
      <BrandMark />
      {!compact && (
        <span className="brand-text">
          <strong>EZReader</strong>
          <small>{t('app.tagline')}</small>
        </span>
      )}
    </Link>
  )
}
