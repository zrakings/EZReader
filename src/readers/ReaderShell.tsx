import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronRight,
  ListTree,
  Maximize,
  Minimize,
  NotebookPen,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { DocumentMeta, Note, ReaderLocation } from '../types'
import { isEditableElement } from '../utils/format'
import { Modal } from '../components/common/Modal'
import { NoteFormModal } from '../components/common/NoteFormModal'
import { ProgressBar } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'
import type { TocEntry } from './types'

type Panel = 'toc' | 'bookmarks' | 'notes' | 'search' | 'settings' | null

interface ReaderShellProps {
  doc: DocumentMeta
  location: ReaderLocation | null
  progress: number
  toc?: TocEntry[]
  onNavigate: (location: ReaderLocation) => void
  onClose: () => void
  settings?: ReactNode
  search?: ReactNode
  controls?: ReactNode
  children: ReactNode
}

export function ReaderShell({
  doc,
  location,
  progress,
  toc = [],
  onNavigate,
  onClose,
  settings,
  search,
  controls,
  children,
}: ReaderShellProps) {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const rootRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [bookmarkOpen, setBookmarkOpen] = useState(false)
  const [bookmarkName, setBookmarkName] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [fullscreen, setFullscreen] = useState(Boolean(window.document.fullscreenElement))
  const [dismissedCompletion, setDismissedCompletion] = useState(false)

  const bookmarks = state.bookmarks.filter((bookmark) => bookmark.documentId === doc.id)
  const notes = state.notes.filter((note) => note.documentId === doc.id)
  const series = state.series.find((item) => item.documentIds.includes(doc.id))
  const seriesIndex = series ? series.documentIds.indexOf(doc.id) : -1
  const nextId =
    series && seriesIndex >= 0 && seriesIndex < series.documentIds.length - 1
      ? series.documentIds[seriesIndex + 1]
      : null
  const nextDocument = nextId ? state.documents.find((doc) => doc.id === nextId) : null
  const completed = doc.progress >= 0.995 || Boolean(doc.completedAt)

  useEffect(() => {
    setDismissedCompletion(false)
    setPanel(null)
  }, [doc.id])

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(window.document.fullscreenElement))
    window.document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!window.document.fullscreenElement) await rootRef.current?.requestFullscreen()
      else await window.document.exitFullscreen()
    } catch {
      toast(t('toast.notSupported'), 'warning')
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && search) {
        event.preventDefault()
        setPanel('search')
        return
      }
      if (event.key === 'Escape') {
        if (panel) {
          event.preventDefault()
          setPanel(null)
        }
        return
      }
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        void toggleFullscreen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const openBookmark = () => {
    if (!location) return
    setBookmarkName(
      location.label || `${t('reader.page')} ${location.page ?? ''}`.trim(),
    )
    setBookmarkOpen(true)
  }

  const openNote = () => {
    if (!location) return
    setEditingNote(null)
    setNoteOpen(true)
  }

  const removeBookmark = async (id: string) => {
    const ok = await confirm({
      title: t('bookmarks.delete'),
      description: t('reader.confirmDelete'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteBookmark(id)
    toast(t('toast.deleted'), 'success')
  }

  const removeNote = async (id: string) => {
    const ok = await confirm({
      title: t('notes.deleteTitle'),
      description: t('reader.deleteNoteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteNote(id)
    toast(t('toast.deleted'), 'success')
  }

  const panelTitle =
    panel === 'toc'
      ? t('reader.toc')
      : panel === 'bookmarks'
        ? t('reader.bookmarks')
        : panel === 'notes'
          ? t('reader.notes')
          : panel === 'search'
            ? t('reader.search')
            : t('reader.settings')

  return (
    <div className="reader-root" ref={rootRef}>
      <header className="reader-topbar">
        <button type="button" className="reader-back" onClick={onClose} title={t('reader.closeReader')}>
          <ArrowLeft size={18} />
          <span>{t('reader.backToLibrary')}</span>
        </button>

        <div className="reader-title-block">
          <strong title={doc.title}>{doc.title}</strong>
          <span>
            {location?.label || t('reader.loadingDocument')}
            {' · '}
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="reader-top-progress">
          <ProgressBar value={progress} />
        </div>

        <div className="reader-top-actions">
          <button
            type="button"
            className={`reader-tool ${panel === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'bookmarks' ? null : 'bookmarks')}
            title={t('reader.bookmarks')}
          >
            <Bookmark size={18} />
            <span>{t('reader.bookmarks')}</span>
          </button>
          <button
            type="button"
            className={`reader-tool ${panel === 'notes' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'notes' ? null : 'notes')}
            title={t('reader.notes')}
          >
            <NotebookPen size={18} />
            <span>{t('reader.notes')}</span>
          </button>
          <button
            type="button"
            className={`reader-tool ${panel === 'toc' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
            title={t('reader.toc')}
          >
            <ListTree size={18} />
            <span>{t('reader.toc')}</span>
          </button>
          {search && (
            <button
              type="button"
              className={`reader-tool ${panel === 'search' ? 'active' : ''}`}
              onClick={() => setPanel(panel === 'search' ? null : 'search')}
              title={t('reader.search')}
            >
              <Search size={18} />
              <span>{t('reader.search')}</span>
            </button>
          )}
          <button
            type="button"
            className={`reader-tool ${panel === 'settings' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            title={t('reader.settings')}
          >
            <SlidersHorizontal size={18} />
            <span>{t('reader.settings')}</span>
          </button>
          <button
            type="button"
            className="reader-tool icon-only fullscreen"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? t('reader.exitFullscreen') : t('reader.fullscreen')}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button type="button" className="reader-tool icon-only close" onClick={onClose} title={t('reader.closeReader')}>
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="reader-body">
        <main className="reader-stage">{children}</main>

        {panel && (
          <aside className="reader-panel" aria-label={panelTitle}>
            <header className="reader-panel-head">
              <h2>{panelTitle}</h2>
              <div>
                {panel === 'bookmarks' && (
                  <button type="button" className="button button-ghost button-small" onClick={openBookmark} disabled={!location}>
                    <Bookmark size={14} />
                    {t('bookmarks.add')}
                  </button>
                )}
                {panel === 'notes' && (
                  <button type="button" className="button button-ghost button-small" onClick={openNote} disabled={!location}>
                    <NotebookPen size={14} />
                    {t('notes.add')}
                  </button>
                )}
                <button type="button" className="icon-button" onClick={() => setPanel(null)} aria-label={t('common.close')}>
                  <X size={17} />
                </button>
              </div>
            </header>

            <div className="reader-panel-body">
              {panel === 'toc' &&
                (toc.length === 0 ? (
                  <div className="reader-panel-empty">{t('reader.tocEmpty')}</div>
                ) : (
                  <div className="reader-toc-list">
                    {toc.map((entry, index) => (
                      <button
                        type="button"
                        key={`${entry.label}-${index}`}
                        className="reader-toc-item"
                        style={{ paddingLeft: `${12 + (entry.depth ?? 0) * 14}px` }}
                        onClick={() => {
                          onNavigate(entry.location)
                          setPanel(null)
                        }}
                      >
                        <span>{entry.label || t('common.unknown')}</span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                ))}

              {panel === 'bookmarks' &&
                (bookmarks.length === 0 ? (
                  <div className="reader-panel-empty">{t('bookmarks.emptyText')}</div>
                ) : (
                  <div className="reader-panel-list">
                    {bookmarks.map((bookmark) => (
                      <div className="reader-panel-item" key={bookmark.id}>
                        <button type="button" className="reader-panel-item-main" onClick={() => onNavigate(bookmark.location)}>
                          <Bookmark size={15} />
                          <span>
                            <strong>{bookmark.name}</strong>
                            <small>{bookmark.location.label}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="icon-button tiny danger-text"
                          aria-label={t('bookmarks.delete')}
                          onClick={() => void removeBookmark(bookmark.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

              {panel === 'notes' &&
                (notes.length === 0 ? (
                  <div className="reader-panel-empty">{t('notes.emptyText')}</div>
                ) : (
                  <div className="reader-panel-list">
                    {notes.map((note) => (
                      <div className="reader-panel-item note" key={note.id}>
                        <button type="button" className="reader-panel-item-main" onClick={() => onNavigate(note.location)}>
                          <NotebookPen size={15} />
                          <span>
                            <strong>{note.title}</strong>
                            <small>{note.content}</small>
                            <em>{note.location.label}</em>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="icon-button tiny"
                          aria-label={t('common.edit')}
                          onClick={() => {
                            setEditingNote(note)
                            setNoteOpen(true)
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button tiny danger-text"
                          aria-label={t('common.delete')}
                          onClick={() => void removeNote(note.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

              {panel === 'search' && search}
              {panel === 'settings' && settings}
            </div>
          </aside>
        )}
      </div>

      {completed && !dismissedCompletion && (
        <div className="reader-completion">
          <div>
            <strong>{t('reader.completed')}</strong>
            <span>{t('reader.completedBanner')}</span>
          </div>
          <div className="reader-completion-actions">
            {nextDocument ? (
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => navigate(`/read/${nextDocument.id}`)}
              >
                {t('reader.nextVolume')}: {nextDocument.title}
                <ArrowRight size={15} />
              </button>
            ) : series ? (
              <span className="reader-series-finished">{t('series.finished')}</span>
            ) : null}
            <button type="button" className="button button-ghost button-small" onClick={() => setDismissedCompletion(true)}>
              {t('reader.keepReading')}
            </button>
          </div>
        </div>
      )}

      {controls && <div className="reader-bottom-controls">{controls}</div>}

      {bookmarkOpen && location && (
        <Modal
          title={t('reader.addBookmark')}
          onClose={() => setBookmarkOpen(false)}
          size="small"
          closeLabel={t('common.close')}
          footer={
            <>
              <button type="button" className="button button-ghost" onClick={() => setBookmarkOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!bookmarkName.trim()}
                onClick={() => {
                  store.addBookmark({
                    documentId: doc.id,
                    name: bookmarkName.trim(),
                    location,
                  })
                  setBookmarkOpen(false)
                  toast(t('reader.bookmarkAdded'), 'success')
                }}
              >
                {t('reader.saveBookmark')}
              </button>
            </>
          }
        >
          <label className="field">
            <span>{t('bookmarks.name')}</span>
            <input
              value={bookmarkName}
              onChange={(event) => setBookmarkName(event.target.value)}
              placeholder={t('bookmarks.placeholder')}
              autoFocus
              maxLength={140}
            />
          </label>
          <div className="notice notice-muted">
            {t('reader.currentLocation')}: <strong>{location.label}</strong>
          </div>
        </Modal>
      )}

      {noteOpen && location && (
        <NoteFormModal
          initial={editingNote}
          location={editingNote?.location ?? location}
          onClose={() => {
            setNoteOpen(false)
            setEditingNote(null)
          }}
          onSave={(values) => {
            if (editingNote) {
              store.updateNote(editingNote.id, values)
            } else {
              store.addNote({
                documentId: doc.id,
                title: values.title,
                content: values.content,
                location,
              })
            }
            toast(t('reader.noteAdded'), 'success')
          }}
        />
      )}

      <span className="sr-only" aria-live="polite">
        {location?.label} · {Math.round(progress * 100)}%
      </span>
      <span className="sr-only">{language}</span>
    </div>
  )
}
