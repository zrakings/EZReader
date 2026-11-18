import { FolderKanban, Layers, Pencil, Trash2 } from 'lucide-react'
import { useAppState, useI18n } from '../../hooks/useAppStore'
import type { Collection, Series } from '../../types'
import { formatPercent } from '../../utils/format'
import { resolveGroupCover } from '../../utils/groupCover'
import { ActionMenu } from '../common/ActionMenu'
import { Cover } from '../common/Cover'
import { ProgressBar } from '../common/UI'

interface GroupCardProps {
  group: Collection | Series
  kind: 'collection' | 'series'
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

export function GroupCard({ group, kind, onOpen, onEdit, onDelete }: GroupCardProps) {
  const { t } = useI18n()
  const state = useAppState()
  const documents = group.documentIds
    .map((id) => state.documents.find((doc) => doc.id === id))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
  const cover = resolveGroupCover(group, documents, state.covers)
  const progress =
    documents.length > 0
      ? documents.reduce((sum, doc) => sum + doc.progress, 0) / documents.length
      : 0
  const completed = documents.filter((doc) => doc.completedAt || doc.progress >= 0.995).length
  const menuItems = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    {
      label: kind === 'collection' ? t('collections.deleteTitle') : t('series.deleteTitle'),
      icon: Trash2,
      onClick: onDelete,
      danger: true,
    },
  ]

  return (
    <article
      className="group-card"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="group-card-cover-wrap">
        <div className="group-card-mosaic">
          <Cover
            src={cover.src}
            title={group.name}
            format={cover.format}
            showFormat={false}
            className="group-main-cover"
          />
          {documents.slice(1, 3).map((doc, index) => (
            <div className={`group-mosaic-extra extra-${index + 1}`} key={doc.id}>
              <Cover src={state.covers[doc.id]} title={doc.title} format={doc.format} showFormat={false} />
            </div>
          ))}
        </div>
        <div className="group-kind-icon">
          {kind === 'collection' ? <FolderKanban size={15} /> : <Layers size={15} />}
        </div>
        <span onClick={(event) => event.stopPropagation()} className="group-menu">
          <ActionMenu items={menuItems} label={t('common.more')} />
        </span>
      </div>
      <div className="group-card-info">
        <h3>{group.name}</h3>
        <p>
          {kind === 'collection'
            ? t('collections.documents', { count: documents.length })
            : t('series.volumes', { count: documents.length })}
          {documents.length > 0 && ` · ${formatPercent(progress)}`}
        </p>
        {kind === 'series' && documents.length > 0 && (
          <div className="group-progress-note">
            <ProgressBar value={progress} />
            <span>{completed}/{documents.length}</span>
          </div>
        )}
      </div>
    </article>
  )
}
