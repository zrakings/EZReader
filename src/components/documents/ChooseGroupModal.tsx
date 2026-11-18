import { useMemo, useState } from 'react'
import { Check, FolderKanban, Layers, Plus, Search } from 'lucide-react'
import { useAppState, useI18n } from '../../hooks/useAppStore'
import { store } from '../../services/storage/store'
import type { Collection, Series } from '../../types'
import { GroupFormModal } from '../collections/GroupFormModal'
import { Modal } from '../common/Modal'

interface ChooseGroupModalProps {
  kind: 'collection' | 'series'
  documentIds: string[]
  onClose: () => void
  onDone?: () => void
}

export function ChooseGroupModal({ kind, documentIds, onClose, onDone }: ChooseGroupModalProps) {
  const { t } = useI18n()
  const state = useAppState()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const groups: Array<Collection | Series> = kind === 'collection' ? state.collections : state.series

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((group) => group.name.toLowerCase().includes(query))
  }, [groups, search])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addLabel = kind === 'collection' ? t('library.addToCollection') : t('library.addToSeries')

  if (creating) {
    return (
      <GroupFormModal
        kind={kind}
        documents={state.documents}
        covers={state.covers}
        onClose={() => setCreating(false)}
        onSave={(values) => {
          if (kind === 'collection') {
            const id = store.createCollection({ ...values, documentIds })
            store.addDocumentsToCollection(id, documentIds)
          } else {
            const id = store.createSeries({ ...values, documentIds })
            store.addDocumentsToSeries(id, documentIds)
          }
          onDone?.()
          onClose()
        }}
      />
    )
  }

  return (
    <Modal
      title={addLabel}
      subtitle={
        kind === 'collection'
          ? t('collections.subtitle')
          : t('series.subtitle')
      }
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={selected.size === 0}
            onClick={() => {
              selected.forEach((id) => {
                if (kind === 'collection') store.addDocumentsToCollection(id, documentIds)
                else store.addDocumentsToSeries(id, documentIds)
              })
              onDone?.()
              onClose()
            }}
          >
            {t('common.add')}
          </button>
        </>
      }
    >
      <div className="choose-group-toolbar">
        <label className="search-input">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('common.search')}
            autoFocus
          />
        </label>
        <button type="button" className="button button-ghost button-small" onClick={() => setCreating(true)}>
          <Plus size={15} />
          {kind === 'collection' ? t('collections.create') : t('series.create')}
        </button>
      </div>
      <div className="picker-list">
        {filtered.length === 0 ? (
          <div className="picker-empty">
            {groups.length === 0
              ? kind === 'collection'
                ? t('collections.emptyText')
                : t('series.emptyText')
              : t('library.emptySearch')}
          </div>
        ) : (
          filtered.map((group) => {
            const contains = documentIds.every((id) => group.documentIds.includes(id))
            const isSelected = selected.has(group.id)
            return (
              <button
                type="button"
                className={`picker-row ${isSelected ? 'selected' : ''} ${contains ? 'already-added' : ''}`}
                key={group.id}
                onClick={() => {
                  if (!contains) toggle(group.id)
                }}
                disabled={contains}
              >
                <span className="choose-group-icon">
                  {kind === 'collection' ? <FolderKanban size={18} /> : <Layers size={18} />}
                </span>
                <span className="picker-main">
                  <span className="picker-title">{group.name}</span>
                  <span className="picker-sub">
                    {kind === 'collection'
                      ? t('collections.documents', { count: group.documentIds.length })
                      : t('series.volumes', { count: group.documentIds.length })}
                    {group.description ? ` · ${group.description}` : ''}
                  </span>
                </span>
                <span className={`picker-check ${isSelected ? 'checked' : ''}`}>
                  {contains ? t('addDocs.alreadyAdded') : isSelected ? <Check size={14} /> : null}
                </span>
              </button>
            )
          })
        )}
      </div>
    </Modal>
  )
}
