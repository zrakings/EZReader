import { useEffect, useState, type CSSProperties } from 'react'
import type { DocumentFormat } from '../../types'
import { FORMAT_TONES, formatLabel } from '../../utils/format'
import { placeholderCover } from '../../utils/cover'

interface CoverProps {
  src?: string | null
  title: string
  format: DocumentFormat
  extension?: string
  className?: string
  showFormat?: boolean
}

export function Cover({ src, title, format, extension = '', className = '', showFormat = true }: CoverProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])
  const image = src && !failed ? src : placeholderCover(title, format)
  return (
    <div
      className={`cover ${className}`}
      style={{ '--cover-tone': FORMAT_TONES[format] } as CSSProperties}
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
      <div className="cover-shine" aria-hidden="true" />
      {showFormat && <span className="cover-format">{formatLabel(format, extension)}</span>}
    </div>
  )
}

export function FormatBadge({
  format,
  extension,
  label,
}: {
  format: DocumentFormat
  extension?: string
  label?: string
}) {
  return (
    <span
      className="format-badge"
      style={{ '--badge-color': FORMAT_TONES[format] } as CSSProperties}
    >
      {label ?? formatLabel(format, extension)}
    </span>
  )
}
