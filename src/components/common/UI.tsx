import type { CSSProperties, ReactNode } from 'react'
import { Search, X } from 'lucide-react'

export function ProgressBar({
  value,
  className = '',
  label,
}: {
  value: number
  className?: string
  label?: string
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className={`progress-track ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  compact = false,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-state-compact' : ''}`}>
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
  label = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  label?: string
}) {
  return (
    <label className={`search-input ${className}`}>
      <Search size={17} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </label>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SkeletonCard({ list = false }: { list?: boolean }) {
  if (list) {
    return (
      <div className="skeleton-list-row">
        <div className="skeleton skeleton-cover-small" />
        <div className="skeleton-lines">
          <div className="skeleton skeleton-line wide" />
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    )
  }
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-cover" />
      <div className="skeleton skeleton-line wide" />
      <div className="skeleton skeleton-line" />
    </div>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ '--dot-color': color } as CSSProperties} />
}

export function StatValue({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat-value">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
