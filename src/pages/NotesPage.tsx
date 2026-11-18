import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, MapPin, NotebookPen, Pencil, Search, Trash2 } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { Note } from '../types'
import { encodeLocation, relativeTime } from '../utils/format'
import { Cover, FormatBadge } from '../components/common/Cover'
import { NoteFormModal } from '../components/common/NoteFormModal'
import { EmptyState, PageHeader } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function NotesPage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)

  const notes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.notes
      .map((note) => ({
        note,
        document: state.documents.find((doc) => doc.id === note.documentId),
      }))
      .filter((item): item is { note: Note; document: NonNullable<typeof item.document> } => Boolean(item.document))
      .filter(({ note, document }) => {
        if (!needle) return true
        return `${note.title} ${note.content} ${document.title}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt))
  }, [state.notes, state.documents, query])

  const remove = async (note: Note) => {
    const ok = await confirm({
      title: t('notes.deleteTitle'),
      description: t('reader.deleteNoteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteNote(note.id)
    toast(t('toast.deleted'), 'success')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('nav.organize')}
        title={t('notes.title')}
        subtitle={t('notes.subtitle')}
      />

      {state.notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={30} />}
          title={t('notes.empty')}
          text={t('notes.emptyText')}
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
                placeholder={t('notes.searchPlaceholder')}
              />
            </label>
            <span className="list-count">{notes.length}</span>
          </div>

          {notes.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title={t('library.emptySearch')} text={t('library.emptySearchText')} compact />
          ) : (
            <div className="notes-grid">
              {notes.map(({ note, document }) => (
                <article className="note-card" key={note.id}>
                  <div className="note-head">
                    <Cover
                      src={state.covers[document.id]}
                      title={document.title}
                      format={document.format}
                      extension={document.extension}
                      className="note-cover"
                      showFormat={false}
                    />
                    <div className="note-doc">
                      <strong>{document.title}</strong>
                      <span>
                        <FormatBadge format={document.format} extension={document.extension} />
                        <span className="note-time">{relativeTime(note.updatedAt, language)}</span>
                      </span>
                    </div>
                  </div>
                  <h3>{note.title}</h3>
                  <p className="note-content">{note.content}</p>
                  <div className="note-location">
                    <MapPin size={14} />
                    <span>{note.location.label || t('common.unknown')}</span>
                  </div>
                  <footer className="note-actions">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => {
                        const encoded = encodeLocation(note.location)
                        navigate(`/read/${document.id}${encoded ? `?loc=${encoded}` : ''}`)
                      }}
                    >
                      <BookOpen size={15} />
                      {t('notes.view')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => setEditing(note)}
                    >
                      <Pencil size={15} />
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      onClick={() => void remove(note)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <NoteFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            store.updateNote(editing.id, values)
            toast(t('toast.saved'), 'success')
          }}
        />
      )}
    </div>
  )
}
