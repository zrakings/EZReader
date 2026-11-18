import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useAppState, useI18n } from '../../hooks/useAppStore'
import type { DocumentMeta } from '../../types'
import { baseName, formatPercent } from '../../utils/format'
import { Modal } from '../common/Modal'
import { Cover, FormatBadge } from '../common/Cover'
import { ProgressBar } from '../common/UI'

interface AddToGroupModalProps {
  title: string
  subtitle?: string
  documents: DocumentMeta[]
  alreadyAddedIds: string[]
  onAdd: (ids: string[]) => void
  onClose: () => void
  addLabel?: string
}

export function AddToGroupModal({
  title,
  subtitle,
  documents,
  alreadyAddedIds,
  onAdd,
  onClose,
  addLabel,
}: AddToGroupModalProps) {
  const { t } = useI18n()
  const covers = useAppState().covers
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const existing = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter((doc) => {
      if (!query) return true
      return doc.title.toLowerCase().includes(query) || doc.fileName.toLowerCase().includes(query)
    })
  }, [documents, search])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      size="large"
      closeLabel={t('common.close')}
      footer={
        <>
          <span className="modal-selection-count">
            {t('library.selected', { count: selected.size })}
          </span>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={selected.size === 0}
            onClick={() => {
              onAdd(Array.from(selected))
              onClose()
            }}
          >
            {addLabel ?? t('common.add')}
          </button>
        </>
      }
    >
      <label className="search-input modal-search">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('library.searchPlaceholder')}
          autoFocus
        />
      </label>
      <div className="picker-list">
        {filtered.length === 0 ? (
          <div className="picker-empty">{t('library.emptySearch')}</div>
        ) : (
          filtered.map((doc) => {
            const isExisting = existing.has(doc.id)
            const isSelected = selected.has(doc.id)
            return (
              <button
                type="button"
                className={`picker-row ${isSelected ? 'selected' : ''} ${isExisting ? 'already-added' : ''}`}
                key={doc.id}
                onClick={() => {
                  if (!isExisting) toggle(doc.id)
                }}
                disabled={isExisting}
              >
                <Cover
                  src={covers[doc.id]}
                  title={doc.title}
                  format={doc.format}
                  extension={doc.extension}
                  className="picker-cover"
                  showFormat={false}
                />
                <span className="picker-main">
                  <span className="picker-title">{doc.title || baseName(doc.fileName)}</span>
                  <span className="picker-sub">
                    <FormatBadge format={doc.format} extension={doc.extension} />
                    {doc.progress > 0 && <span>{formatPercent(doc.progress)}</span>}
                  </span>
                  {doc.progress > 0 && <ProgressBar value={doc.progress} />}
                </span>
                <span className={`picker-check ${isSelected ? 'checked' : ''}`}>
                  {isExisting ? t('addDocs.alreadyAdded') : isSelected ? <Check size={14} /> : null}
                </span>
              </button>
            )
          })
        )}
      </div>
    </Modal>
  )
}
