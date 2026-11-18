import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, History, Search, Trash2, X } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { DocumentMeta, HistoryEntry } from '../types'
import { formatPercent, relativeTime } from '../utils/format'
import { Cover, FormatBadge } from '../components/common/Cover'
import { EmptyState, PageHeader, ProgressBar } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

type HistoryRow = { entry: HistoryEntry; document: DocumentMeta }

export function HistoryPage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [query, setQuery] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.history
      .map((entry) => ({
        entry,
        document: state.documents.find((doc) => doc.id === entry.documentId),
      }))
      .filter((item): item is HistoryRow => Boolean(item.document))
      .filter(({ document }) => {
        if (!needle) return true
        return `${document.title} ${document.fileName}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => b.entry.lastReadAt.localeCompare(a.entry.lastReadAt))
  }, [state.history, state.documents, query])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: t('history.clearConfirmTitle'),
      description: t('history.clearConfirmText'),
      confirmLabel: t('history.clearAll'),
      danger: true,
    })
    if (!ok) return
    store.clearHistory()
    setSelected(new Set())
    setSelectionMode(false)
    toast(t('toast.historyCleared'), 'success')
  }

  const removeOne = async (documentId: string) => {
    const ok = await confirm({
      title: t('history.deleteConfirmTitle'),
      description: t('history.deleteConfirmText'),
      confirmLabel: t('common.remove'),
      danger: true,
    })
    if (!ok) return
    store.removeHistory([documentId])
    toast(t('toast.deleted'), 'success')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('nav.activity')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        actions={
          state.history.length > 0 ? (
            <button type="button" className="button button-ghost" onClick={() => void clearAll()}>
              <Trash2 size={16} />
              {t('history.clearAll')}
            </button>
          ) : undefined
        }
      />

      {state.history.length === 0 ? (
        <EmptyState
          icon={<History size={30} />}
          title={t('history.empty')}
          text={t('history.emptyText')}
          action={
            <button type="button" className="button button-primary" onClick={() => navigate('/library')}>
              {t('nav.allDocuments')}
            </button>
          }
        />
      ) : (
        <>
          <div className="list-toolbar">
            <label className="search-input">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('history.searchPlaceholder')}
              />
            </label>
            <button
              type="button"
              className={`button button-ghost button-small ${selectionMode ? 'is-active' : ''}`}
              onClick={() => {
                setSelectionMode((value) => !value)
                setSelected(new Set())
              }}
            >
              <CheckSquare size={15} />
              {selectionMode ? t('common.done') : t('library.select')}
            </button>
            {selectionMode && (
              <>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() =>
                    setSelected(
                      selected.size === entries.length
                        ? new Set()
                        : new Set(entries.map(({ document }) => document.id)),
                    )
                  }
                >
                  {selected.size === entries.length ? t('library.deselectAll') : t('library.selectAll')}
                </button>
                <button
                  type="button"
                  className="button button-danger button-small"
                  disabled={selected.size === 0}
                  onClick={() => {
                    store.removeHistory(Array.from(selected))
                    setSelected(new Set())
                    setSelectionMode(false)
                    toast(t('toast.deleted'), 'success')
                  }}
                >
                  <Trash2 size={15} />
                  {t('history.deleteSelected')}
                </button>
                <button type="button" className="icon-button" onClick={() => setSelectionMode(false)}>
                  <X size={16} />
                </button>
              </>
            )}
          </div>

          {entries.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title={t('library.emptySearch')} text={t('library.emptySearchText')} compact />
          ) : (
            <div className="history-list">
              {entries.map(({ entry, document }) => {
                const isSelected = selected.has(document.id)
                return (
                  <div className={`history-row ${isSelected ? 'is-selected' : ''}`} key={document.id}>
                    {selectionMode && (
                      <button
                        type="button"
                        className={`select-check inline ${isSelected ? 'checked' : ''}`}
                        onClick={() => toggle(document.id)}
                        aria-label={t('library.selected', { count: selected.size })}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                    )}
                    <button
                      type="button"
                      className="history-main"
                      onClick={() => (selectionMode ? toggle(document.id) : navigate(`/read/${document.id}`))}
                    >
                      <Cover
                        src={state.covers[document.id]}
                        title={document.title}
                        format={document.format}
                        extension={document.extension}
                        className="history-cover"
                        showFormat={false}
                      />
                      <span className="history-copy">
                        <span className="history-title">{document.title}</span>
                        <span className="history-meta">
                          <FormatBadge format={document.format} extension={document.extension} />
                          <span className={`status-pill status-${entry.status}`}>{t(`filters.${entry.status}`)}</span>
                          <span>{formatPercent(entry.progress)}</span>
                        </span>
                        <ProgressBar value={entry.progress} />
                        <span className="history-dates">
                          <span>
                            {t('history.lastRead')}: {relativeTime(entry.lastReadAt, language)}
                          </span>
                          <span>
                            {t('history.opened')}: {relativeTime(entry.lastOpenedAt, language)}
                          </span>
                        </span>
                      </span>
                    </button>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => navigate(`/read/${document.id}`)}
                      >
                        <BookOpen size={15} />
                        {entry.progress > 0 ? t('common.continue') : t('common.read')}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                        onClick={() => void removeOne(document.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
