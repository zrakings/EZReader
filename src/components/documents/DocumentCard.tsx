import { Link2Off, ListPlus, Pencil, Star, Trash2, FolderPlus, BookOpen, Check, FileText } from 'lucide-react'
import { useAppSelector, useI18n, useIsFileAvailable } from '../../hooks/useAppStore'
import type { DocumentMeta } from '../../types'
import { formatLabel, formatPercent, relativeTime } from '../../utils/format'
import { ActionMenu } from '../common/ActionMenu'
import { Cover, FormatBadge } from '../common/Cover'
import { ProgressBar } from '../common/UI'

interface DocumentCardProps {
  document: DocumentMeta
  view: 'grid' | 'list'
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onOpen: () => void
  onDetails: () => void
  onRename: () => void
  onRemove: () => void
  onFavorite: () => void
  onAddToCollection: () => void
  onAddToSeries: () => void
}

export function DocumentCard({
  document,
  view,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onOpen,
  onDetails,
  onRename,
  onRemove,
  onFavorite,
  onAddToCollection,
  onAddToSeries,
}: DocumentCardProps) {
  const { t, language } = useI18n()
  const cover = useAppSelector((state) => state.covers[document.id])
  const available = useIsFileAvailable(document.id)
  const progress = Math.min(1, Math.max(0, document.progress))
  const completed = Boolean(document.completedAt) || progress >= 0.995
  const continueLabel = progress > 0 && !completed ? t('card.continue') : t('card.read')

  const menuItems = [
    {
      label: available ? continueLabel : t('card.locate'),
      icon: BookOpen,
      onClick: onOpen,
    },
    { label: t('common.details'), icon: FileText, onClick: onDetails },
    {
      label: document.favorite ? t('card.unfavorite') : t('card.favorite'),
      icon: Star,
      onClick: onFavorite,
    },
    { label: t('card.addCollection'), icon: FolderPlus, onClick: onAddToCollection },
    { label: t('card.addSeries'), icon: ListPlus, onClick: onAddToSeries },
    { label: t('card.rename'), icon: Pencil, onClick: onRename },
    { label: t('card.remove'), icon: Trash2, onClick: onRemove, danger: true },
  ]

  const handleClick = () => {
    if (selectionMode) onToggleSelect?.()
    else onOpen()
  }

  const statusLine = completed
    ? t('card.complete')
    : progress > 0
      ? t('card.progress', { percent: formatPercent(progress) })
      : t('card.unread')

  return (
    <article
      className={`document-card view-${view} ${selected ? 'is-selected' : ''} ${selectionMode ? 'selection-mode' : ''}`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      tabIndex={0}
      aria-label={document.title}
    >
      <div className="document-cover-wrap">
        <Cover
          src={cover}
          title={document.title}
          format={document.format}
          extension={document.extension}
          className="document-cover"
          showFormat={false}
        />
        <div className="cover-topline">
          <FormatBadge format={document.format} extension={document.extension} />
          {selectionMode ? (
            <span className={`select-check ${selected ? 'checked' : ''}`} aria-hidden="true">
              {selected && <Check size={13} />}
            </span>
          ) : (
            <div className="cover-quick-actions">
              <button
                type="button"
                className={`icon-button cover-action ${document.favorite ? 'is-favorite' : ''}`}
                aria-label={document.favorite ? t('card.unfavorite') : t('card.favorite')}
                onClick={(event) => {
                  event.stopPropagation()
                  onFavorite()
                }}
              >
                <Star size={16} fill={document.favorite ? 'currentColor' : 'none'} />
              </button>
              <span onClick={(event) => event.stopPropagation()}>
                <ActionMenu items={menuItems} label={t('card.actions')} />
              </span>
            </div>
          )}
        </div>
        {progress > 0 && (
          <div className="cover-progress">
            <ProgressBar value={progress} aria-label={statusLine} />
          </div>
        )}
        {!available && (
          <div className="needs-file-badge">
            <Link2Off size={12} />
            {t('library.needsFile')}
          </div>
        )}
      </div>
      <div className="document-info">
        <div className="document-title-row">
          <h3 title={document.title}>{document.title}</h3>
          {view === 'list' && !selectionMode && (
            <span onClick={(event) => event.stopPropagation()}>
              <ActionMenu items={menuItems} label={t('card.actions')} />
            </span>
          )}
        </div>
        <div className="document-meta">
          <span>{formatLabel(document.format, document.extension)}</span>
          {document.totalPages > 0 && (
            <>
              <span className="meta-dot">·</span>
              <span>{t('card.pages', { count: document.totalPages })}</span>
            </>
          )}
        </div>
        <div className={`document-status ${completed ? 'complete' : ''}`}>
          <span>{statusLine}</span>
          {document.lastOpenedAt && <span>{relativeTime(document.lastOpenedAt, language)}</span>}
        </div>
        {view === 'list' && progress > 0 && <ProgressBar value={progress} className="list-progress" />}
      </div>
    </article>
  )
}
