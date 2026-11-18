import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookOpen, MapPin, Pencil, Search, Trash2 } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { Bookmark as BookmarkType } from '../types'
import { encodeLocation, formatDateTime, relativeTime } from '../utils/format'
import { Cover, FormatBadge } from '../components/common/Cover'
import { Modal } from '../components/common/Modal'
import { EmptyState, PageHeader } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function BookmarksPage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<BookmarkType | null>(null)
  const [newName, setNewName] = useState('')

  const bookmarks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.bookmarks
      .map((bookmark) => ({
        bookmark,
        document: state.documents.find((doc) => doc.id === bookmark.documentId),
      }))
      .filter((item): item is { bookmark: BookmarkType; document: NonNullable<typeof item.document> } => Boolean(item.document))
      .filter(({ bookmark, document }) => {
        if (!needle) return true
        return `${bookmark.name} ${bookmark.location.label} ${document.title}`
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => b.bookmark.createdAt.localeCompare(a.bookmark.createdAt))
  }, [state.bookmarks, state.documents, query])

  const remove = async (bookmark: BookmarkType) => {
    const ok = await confirm({
      title: t('bookmarks.delete'),
      description: t('reader.confirmDelete'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteBookmark(bookmark.id)
    toast(t('toast.deleted'), 'success')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('nav.organize')}
        title={t('bookmarks.title')}
        subtitle={t('bookmarks.subtitle')}
      />

      {state.bookmarks.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={30} />}
          title={t('bookmarks.empty')}
          text={t('bookmarks.emptyText')}
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
                placeholder={t('bookmarks.searchPlaceholder')}
              />
            </label>
            <span className="list-count">{bookmarks.length}</span>
          </div>

          {bookmarks.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title={t('library.emptySearch')} text={t('library.emptySearchText')} compact />
          ) : (
            <div className="bookmark-list">
              {bookmarks.map(({ bookmark, document }) => (
                <article className="bookmark-row" key={bookmark.id}>
                  <Cover
                    src={state.covers[document.id]}
                    title={document.title}
                    format={document.format}
                    extension={document.extension}
                    className="bookmark-cover"
                    showFormat={false}
                  />
                  <div className="bookmark-copy">
                    <div className="bookmark-title-row">
                      <h3>{bookmark.name}</h3>
                      <FormatBadge format={document.format} extension={document.extension} />
                    </div>
                    <p className="bookmark-document">{document.title}</p>
                    <div className="bookmark-location">
                      <MapPin size={14} />
                      <span>{bookmark.location.label || t('common.unknown')}</span>
                      <span>·</span>
                      <span>{formatDateTime(bookmark.createdAt, language)}</span>
                    </div>
                  </div>
                  <div className="bookmark-actions">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => {
                        const encoded = encodeLocation(bookmark.location)
                        navigate(`/read/${document.id}${encoded ? `?loc=${encoded}` : ''}`)
                      }}
                    >
                      <BookOpen size={15} />
                      {t('bookmarks.navigate')}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t('bookmarks.rename')}
                      title={t('bookmarks.rename')}
                      onClick={() => {
                        setRenaming(bookmark)
                        setNewName(bookmark.name)
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label={t('bookmarks.delete')}
                      title={t('bookmarks.delete')}
                      onClick={() => void remove(bookmark)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {renaming && (
        <Modal
          title={t('bookmarks.rename')}
          onClose={() => setRenaming(null)}
          size="small"
          closeLabel={t('common.close')}
          footer={
            <>
              <button type="button" className="button button-ghost" onClick={() => setRenaming(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!newName.trim()}
                onClick={() => {
                  store.renameBookmark(renaming.id, newName.trim())
                  setRenaming(null)
                  toast(t('toast.saved'), 'success')
                }}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <label className="field">
            <span>{t('bookmarks.name')}</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('bookmarks.placeholder')}
              autoFocus
              maxLength={140}
            />
          </label>
          <p className="muted-note">
            {t('bookmarks.current')}: {renaming.location.label} · {relativeTime(renaming.createdAt, language)}
          </p>
        </Modal>
      )}
    </div>
  )
}
