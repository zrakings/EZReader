import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  CheckSquare,
  FolderPlus,
  Grid2X2,
  LibraryBig,
  List,
  ListPlus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { useImportDocuments } from '../hooks/useImportDocuments'
import { removeFilesForDocuments } from '../services/storage/fileStore'
import { fileRegistry, store } from '../services/storage/store'
import type { DocumentMeta, DocumentCategory, ReadingStatus, SortKey, ViewMode } from '../types'
import {
  categoryLabel,
  categoryOf,
  formatLabel,
  readingStatus,
} from '../utils/format'
import { SORT_OPTIONS, sortDocuments } from '../utils/sort'
import { DocumentCard } from '../components/documents/DocumentCard'
import { ImportButton } from '../components/documents/ImportButton'
import { ChooseGroupModal } from '../components/documents/ChooseGroupModal'
import { RenameDocumentModal } from '../components/common/RenameDocumentModal'
import { EmptyState, PageHeader, SearchInput } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

type Scope = 'all' | DocumentCategory | 'favorites'

interface LibraryPageProps {
  scope: Scope
}

const SCOPE_FORMATS: Record<Exclude<Scope, 'all' | 'favorites'>, string[]> = {
  pdf: ['pdf'],
  epub: ['epub'],
  comic: ['cbz', 'cbr', 'cb7', 'cbt', 'zip'],
  text: ['txt', 'docx', 'rtf'],
  image: ['image'],
}

export function LibraryPage({ scope }: LibraryPageProps) {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast, confirm } = useUI()
  const { busy } = useImportDocuments()

  const urlQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [sort, setSort] = useState<SortKey>(state.settings.defaultSort)
  const [view, setView] = useState<ViewMode>(state.settings.defaultView)
  const [status, setStatus] = useState<'all' | ReadingStatus>('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renameDocument, setRenameDocument] = useState<DocumentMeta | null>(null)
  const [groupPicker, setGroupPicker] = useState<{ kind: 'collection' | 'series'; ids: string[] } | null>(null)

  useEffect(() => {
    setQuery(urlQuery)
  }, [urlQuery])

  useEffect(() => {
    setSelectionMode(false)
    setSelected(new Set())
    setStatus('all')
    setFormatFilter('all')
  }, [scope])

  const updateQuery = (value: string) => {
    setQuery(value)
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const scopedDocuments = useMemo(() => {
    if (scope === 'all') return state.documents
    if (scope === 'favorites') return state.documents.filter((doc) => doc.favorite)
    const formats = SCOPE_FORMATS[scope]
    return state.documents.filter((doc) => formats.includes(doc.format))
  }, [scope, state.documents])

  const availableFormats = useMemo(() => {
    const set = new Set(scopedDocuments.map((doc) => doc.format))
    return Array.from(set).sort()
  }, [scopedDocuments])

  const documents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = scopedDocuments.filter((doc) => {
      if (needle) {
        const haystack = `${doc.title} ${doc.fileName}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (status !== 'all' && readingStatus(doc) !== status) return false
      if (formatFilter !== 'all' && doc.format !== formatFilter) return false
      return true
    })
    return sortDocuments(filtered, sort)
  }, [scopedDocuments, query, status, formatFilter, sort])

  useEffect(() => {
    setSelected((current) => {
      const available = new Set(documents.map((doc) => doc.id))
      const next = new Set(Array.from(current).filter((id) => available.has(id)))
      return next.size === current.size ? current : next
    })
  }, [documents])

  const title =
    scope === 'all'
      ? t('library.title')
      : scope === 'favorites'
        ? t('favorites.title')
        : t(`nav.${scope === 'comic' ? 'comics' : scope === 'text' ? 'textDocuments' : scope === 'image' ? 'imageCollections' : scope}`)

  const subtitle =
    scope === 'favorites'
      ? t('favorites.subtitle')
      : `${t('library.total', { count: scopedDocuments.length })} · ${t('app.localOnly')}`

  const toggleFavorite = (doc: DocumentMeta) => {
    store.toggleFavorite(doc.id)
    toast(doc.favorite ? t('toast.favoriteRemoved') : t('toast.favoriteAdded'), 'success')
  }

  const requestRemove = async (docs: DocumentMeta[]) => {
    if (!docs.length) return
    const ok = await confirm({
      title:
        docs.length === 1
          ? t('card.deleteConfirmTitle')
          : t('library.deleteManyTitle', { count: docs.length }),
      description:
        docs.length === 1
          ? t('card.deleteConfirmText', { title: docs[0].title })
          : t('library.deleteManyText', { count: docs.length }),
      confirmLabel: t('common.remove'),
      danger: true,
    })
    if (!ok) return
    const removedIds = new Set(docs.map((doc) => doc.id))
    const remaining = state.documents.filter((doc) => !removedIds.has(doc.id))
    docs.forEach((doc) => fileRegistry.remove(doc.id))
    store.removeDocuments(docs.map((doc) => doc.id))
    await removeFilesForDocuments(docs, remaining)
    toast(
      docs.length > 1
        ? t('toast.documentsRemoved', { count: docs.length })
        : t('toast.libraryRemoved'),
      'success',
    )
    setSelected(new Set())
    setSelectionMode(false)
  }

  const selectedDocs = state.documents.filter((doc) => selected.has(doc.id))
  const hasFilters = Boolean(query.trim()) || status !== 'all' || formatFilter !== 'all'
  const emptyLibrary = scopedDocuments.length === 0

  return (
    <div className="page library-page">
      <PageHeader
        eyebrow={t('nav.library')}
        title={title}
        subtitle={subtitle}
        actions={<ImportButton />}
      />

      <div className="library-toolbar">
        <SearchInput
          value={query}
          onChange={updateQuery}
          placeholder={t('library.searchPlaceholder')}
          label={t('common.search')}
          className="library-search"
        />

        <div className="library-tools">
          <label className="tool-select">
            <span>{t('library.sortBy')}</span>
            <select
              value={sort}
              onChange={(event) => {
                const next = event.target.value as SortKey
                setSort(next)
                store.updateSettings({ defaultSort: next })
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="tool-select">
            <span>{t('filters.status')}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | ReadingStatus)}
            >
              <option value="all">{t('filters.allStatus')}</option>
              <option value="unread">{t('filters.unread')}</option>
              <option value="reading">{t('filters.reading')}</option>
              <option value="completed">{t('filters.completed')}</option>
            </select>
          </label>

          {scope === 'all' && availableFormats.length > 1 && (
            <label className="tool-select">
              <span>{t('library.format')}</span>
              <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}>
                <option value="all">{t('library.allFormats')}</option>
                {availableFormats.map((format) => {
                  const doc = scopedDocuments.find((item) => item.format === format)
                  return (
                    <option key={format} value={format}>
                      {formatLabel(format, doc?.extension)}
                    </option>
                  )
                })}
              </select>
            </label>
          )}

          <div className="toolbar-group">
            <button
              type="button"
              className={`icon-button toolbar-toggle ${selectionMode ? 'active' : ''}`}
              aria-label={t('library.select')}
              title={selectionMode ? t('library.deselectAll') : t('library.select')}
              onClick={() => {
                setSelectionMode((value) => !value)
                setSelected(new Set())
              }}
            >
              <CheckSquare size={18} />
            </button>
            <div className="view-toggle" role="group" aria-label={t('settings.defaultView')}>
              <button
                type="button"
                className={view === 'grid' ? 'active' : ''}
                aria-label={t('library.grid')}
                title={t('library.grid')}
                onClick={() => {
                  setView('grid')
                  store.updateSettings({ defaultView: 'grid' })
                }}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                type="button"
                className={view === 'list' ? 'active' : ''}
                aria-label={t('library.list')}
                title={t('library.list')}
                onClick={() => {
                  setView('list')
                  store.updateSettings({ defaultView: 'list' })
                }}
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {(hasFilters || selectionMode) && (
        <div className="library-statusbar">
          <div>
            {selectionMode ? (
              <span className="selection-info">{t('library.selected', { count: selected.size })}</span>
            ) : (
              <span className="filters-active">
                <SlidersHorizontal size={14} />
                {t('library.filtersActive')}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    updateQuery('')
                    setStatus('all')
                    setFormatFilter('all')
                  }}
                >
                  {t('library.clearFilters')}
                </button>
              </span>
            )}
          </div>

          {selectionMode && (
            <div className="bulk-actions">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() =>
                  setSelected(
                    selected.size === documents.length
                      ? new Set()
                      : new Set(documents.map((doc) => doc.id)),
                  )
                }
              >
                {selected.size === documents.length && documents.length > 0
                  ? t('library.deselectAll')
                  : t('library.selectAll')}
              </button>
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={selected.size === 0}
                onClick={() => setGroupPicker({ kind: 'collection', ids: Array.from(selected) })}
              >
                <FolderPlus size={15} />
                {t('library.addToCollection')}
              </button>
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={selected.size === 0}
                onClick={() => setGroupPicker({ kind: 'series', ids: Array.from(selected) })}
              >
                <ListPlus size={15} />
                {t('library.addToSeries')}
              </button>
              <button
                type="button"
                className="button button-danger button-small"
                disabled={selected.size === 0}
                onClick={() => requestRemove(selectedDocs)}
              >
                <Trash2 size={15} />
                {t('library.removeFromLibrary')}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={t('common.close')}
                onClick={() => {
                  setSelectionMode(false)
                  setSelected(new Set())
                }}
              >
                <X size={17} />
              </button>
            </div>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        emptyLibrary ? (
          <EmptyState
            icon={scope === 'favorites' ? <LibraryBig size={30} /> : <BookOpen size={30} />}
            title={
              scope === 'favorites'
                ? t('favorites.empty')
                : query.trim()
                  ? t('library.emptySearch')
                  : t('library.emptyTitle')
            }
            text={
              scope === 'favorites'
                ? t('favorites.emptyText')
                : query.trim()
                  ? t('library.emptySearchText')
                  : hasFilters
                    ? t('library.emptySearchText')
                    : t('library.emptyText')
            }
            action={
              scope !== 'favorites' && !busy ? (
                <ImportButton label={t('dashboard.importFirst')} />
              ) : scope === 'favorites' ? (
                <button type="button" className="button button-primary" onClick={() => navigate('/library')}>
                  {t('nav.allDocuments')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={<SlidersHorizontal size={28} />}
            title={t('library.emptySearch')}
            text={t('library.emptySearchText')}
            compact
            action={
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  updateQuery('')
                  setStatus('all')
                  setFormatFilter('all')
                }}
              >
                {t('library.clearFilters')}
              </button>
            }
          />
        )
      ) : (
        <div className={`library-collection view-${view}`} data-view={view}>
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              view={view}
              selectionMode={selectionMode}
              selected={selected.has(doc.id)}
              onToggleSelect={() =>
                setSelected((current) => {
                  const next = new Set(current)
                  if (next.has(doc.id)) next.delete(doc.id)
                  else next.add(doc.id)
                  return next
                })
              }
              onOpen={() => navigate(`/read/${doc.id}`)}
              onDetails={() => navigate(`/document/${doc.id}`)}
              onRename={() => setRenameDocument(doc)}
              onRemove={() => requestRemove([doc])}
              onFavorite={() => toggleFavorite(doc)}
              onAddToCollection={() => setGroupPicker({ kind: 'collection', ids: [doc.id] })}
              onAddToSeries={() => setGroupPicker({ kind: 'series', ids: [doc.id] })}
            />
          ))}
        </div>
      )}

      <div className="library-footnote">
        {scope !== 'favorites' && documents.length > 0 && (
          <span>
            {t('library.total', { count: documents.length })} · {language === 'id' ? 'PDF, EPUB, komik, teks, gambar' : 'PDF, EPUB, comics, text, images'}
          </span>
        )}
      </div>

      {renameDocument && (
        <RenameDocumentModal
          document={renameDocument}
          onClose={() => setRenameDocument(null)}
          onSave={(nextTitle) => {
            store.updateDocument(renameDocument.id, { title: nextTitle })
            toast(t('toast.saved'), 'success')
          }}
        />
      )}

      {groupPicker && (
        <ChooseGroupModal
          kind={groupPicker.kind}
          documentIds={groupPicker.ids}
          onClose={() => setGroupPicker(null)}
          onDone={() => toast(t('toast.documentsAdded', { count: groupPicker.ids.length }), 'success')}
        />
      )}
    </div>
  )
}
