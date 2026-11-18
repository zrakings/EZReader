import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderKanban,
  HardDrive,
  Layers,
  Link2,
  Link2Off,
  MapPin,
  NotebookPen,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { useAppState, useI18n, useIsFileAvailable } from '../hooks/useAppStore'
import { fileRegistry, store } from '../services/storage/store'
import { matchFileToDocument, pickSingleFile } from '../services/fileHandler/picker'
import type { DocumentMeta } from '../types'
import {
  encodeLocation,
  formatBytes,
  formatDate,
  formatDateTime,
  formatLabel,
  formatPercent,
  readingStatus,
  relativeTime,
} from '../utils/format'
import { Cover, FormatBadge } from '../components/common/Cover'
import { RenameDocumentModal } from '../components/common/RenameDocumentModal'
import { ChooseGroupModal } from '../components/documents/ChooseGroupModal'
import { EmptyState, ProgressBar } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function DocumentDetailPage() {
  const { id } = useParams()
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [renaming, setRenaming] = useState(false)
  const [groupPicker, setGroupPicker] = useState<'collection' | 'series' | null>(null)
  const document = state.documents.find((doc) => doc.id === id)
  const available = useIsFileAvailable(id ?? '')

  if (!document) {
    return (
      <div className="page">
        <EmptyState
          icon={<FileText size={30} />}
          title={t('library.emptyTitle')}
          text={t('library.emptyText')}
          action={
            <Link to="/library" className="button button-primary">
              {t('nav.allDocuments')}
            </Link>
          }
        />
      </div>
    )
  }

  const status = readingStatus(document)
  const collections = state.collections.filter((collection) => collection.documentIds.includes(document.id))
  const series = state.series.filter((item) => item.documentIds.includes(document.id))
  const bookmarks = state.bookmarks.filter((bookmark) => bookmark.documentId === document.id)
  const notes = state.notes.filter((note) => note.documentId === document.id)

  const locateFile = async () => {
    const entry = await pickSingleFile(document.extension)
    if (!entry) {
      toast(t('file.cancelled'), 'info')
      return
    }
    const match = matchFileToDocument(entry.file, document)
    if (!match.exact) {
      const ok = await confirm({
        title: t('file.locateTitle'),
        description: `${t('file.matchWarning')} ${t('file.expected', {
          name: document.fileName,
          size: formatBytes(document.size),
        })}`,
        confirmLabel: t('file.useAnyway'),
      })
      if (!ok) return
    }
    fileRegistry.set(document.id, entry)
    toast(t('file.matchGood'), 'success')
  }

  const remove = async () => {
    const ok = await confirm({
      title: t('card.deleteConfirmTitle'),
      description: t('card.deleteConfirmText', { title: document.title }),
      confirmLabel: t('common.remove'),
      danger: true,
    })
    if (!ok) return
    fileRegistry.remove(document.id)
    store.removeDocuments([document.id])
    toast(t('toast.libraryRemoved'), 'success')
    navigate('/library')
  }

  return (
    <div className="page document-detail-page">
      <div className="detail-back-row">
        <Link to="/library" className="back-link">
          <ArrowLeft size={16} />
          {t('nav.allDocuments')}
        </Link>
      </div>

      <header className="document-detail-header">
        <div className="document-detail-cover">
          <Cover
            src={state.covers[document.id]}
            title={document.title}
            format={document.format}
            extension={document.extension}
            className="document-detail-cover-image"
            showFormat={false}
          />
        </div>
        <div className="document-detail-copy">
          <div className="document-detail-badges">
            <FormatBadge format={document.format} extension={document.extension} />
            <span className={`status-pill status-${status}`}>{t(`filters.${status}`)}</span>
            {available ? (
              <span className="availability-pill available">
                <Link2 size={13} /> {t('library.available')}
              </span>
            ) : (
              <span className="availability-pill missing">
                <Link2Off size={13} /> {t('library.needsFile')}
              </span>
            )}
          </div>
          <h1>{document.title}</h1>
          <p className="document-detail-filename">{document.fileName}</p>
          <div className="document-detail-progress">
            <ProgressBar value={document.progress} />
            <span>{formatPercent(document.progress)}</span>
          </div>
          <div className="document-detail-actions">
            <button type="button" className="button button-primary" onClick={() => navigate(`/read/${document.id}`)}>
              <BookOpen size={16} />
              {document.progress > 0 ? t('common.continue') : t('common.read')}
            </button>
            {!available && (
              <button type="button" className="button button-ghost" onClick={() => void locateFile()}>
                <Link2 size={16} />
                {t('card.locate')}
              </button>
            )}
            <button
              type="button"
              className={`button button-ghost ${document.favorite ? 'is-active' : ''}`}
              onClick={() => {
                store.toggleFavorite(document.id)
                toast(document.favorite ? t('toast.favoriteRemoved') : t('toast.favoriteAdded'), 'success')
              }}
            >
              <Star size={16} fill={document.favorite ? 'currentColor' : 'none'} />
              {document.favorite ? t('card.unfavorite') : t('card.favorite')}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setRenaming(true)}>
              <Pencil size={16} />
              {t('common.rename')}
            </button>
            <button type="button" className="button button-ghost danger-text" onClick={() => void remove()}>
              <Trash2 size={16} />
              {t('library.removeFromLibrary')}
            </button>
          </div>
        </div>
      </header>

      <div className="document-detail-grid">
        <section className="detail-panel">
          <h2>{t('common.details')}</h2>
          <dl className="detail-list">
            <div><dt>{t('library.format')}</dt><dd>{formatLabel(document.format, document.extension)}</dd></div>
            <div><dt>{t('library.total')}</dt><dd>{formatBytes(document.size)}</dd></div>
            <div><dt>{t('common.pages')}</dt><dd>{document.totalPages || t('card.unknownPages')}</dd></div>
            <div><dt>{t('card.added')}</dt><dd>{formatDate(document.addedAt, language)}</dd></div>
            <div><dt>{t('card.lastOpened')}</dt><dd>{document.lastOpenedAt ? formatDateTime(document.lastOpenedAt, language) : t('common.none')}</dd></div>
            {document.completedAt && (
              <div><dt>{t('reader.completed')}</dt><dd>{formatDate(document.completedAt, language)}</dd></div>
            )}
            <div><dt>{t('reader.location')}</dt><dd>{document.lastLocation?.label ?? t('common.none')}</dd></div>
          </dl>
          {document.progress >= 0.995 && (
            <div className="settings-note">
              <CheckCircle2 size={16} />
              <p>{t('reader.completedBanner')}</p>
            </div>
          )}
          {!available && (
            <div className="settings-note">
              <AlertTriangle size={16} />
              <p>{t('file.locateText')}</p>
            </div>
          )}
        </section>

        <section className="detail-panel">
          <h2>{t('document.organization')}</h2>
          <div className="detail-membership">
            <div>
              <h3><FolderKanban size={16} /> {t('nav.collections')}</h3>
              {collections.length === 0 ? (
                <p className="muted-note">{t('dashboard.noCollections')}</p>
              ) : (
                <div className="membership-chips">
                  {collections.map((collection) => (
                    <Link key={collection.id} to={`/collections/${collection.id}`} className="membership-chip">
                      {collection.name}
                    </Link>
                  ))}
                </div>
              )}
              <button type="button" className="text-button" onClick={() => setGroupPicker('collection')}>
                + {t('library.addToCollection')}
              </button>
            </div>
            <div>
              <h3><Layers size={16} /> {t('nav.series')}</h3>
              {series.length === 0 ? (
                <p className="muted-note">{t('series.emptyText')}</p>
              ) : (
                <div className="membership-chips">
                  {series.map((item) => (
                    <Link key={item.id} to={`/series/${item.id}`} className="membership-chip">
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
              <button type="button" className="text-button" onClick={() => setGroupPicker('series')}>
                + {t('library.addToSeries')}
              </button>
            </div>
          </div>
        </section>

        <section className="detail-panel">
          <h2><Bookmark size={16} /> {t('bookmarks.title')}</h2>
          {bookmarks.length === 0 ? (
            <p className="muted-note">{t('bookmarks.emptyText')}</p>
          ) : (
            <div className="detail-activity-list">
              {bookmarks.map((bookmark) => (
                <button
                  type="button"
                  key={bookmark.id}
                  className="detail-activity-row"
                  onClick={() => {
                    const encoded = encodeLocation(bookmark.location)
                    navigate(`/read/${document.id}${encoded ? `?loc=${encoded}` : ''}`)
                  }}
                >
                  <MapPin size={15} />
                  <span>
                    <strong>{bookmark.name}</strong>
                    <small>{bookmark.location.label} · {relativeTime(bookmark.createdAt, language)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detail-panel">
          <h2><NotebookPen size={16} /> {t('notes.title')}</h2>
          {notes.length === 0 ? (
            <p className="muted-note">{t('notes.emptyText')}</p>
          ) : (
            <div className="detail-activity-list">
              {notes.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className="detail-activity-row"
                  onClick={() => {
                    const encoded = encodeLocation(note.location)
                    navigate(`/read/${document.id}${encoded ? `?loc=${encoded}` : ''}`)
                  }}
                >
                  <NotebookPen size={15} />
                  <span>
                    <strong>{note.title}</strong>
                    <small>{note.location.label} · {relativeTime(note.updatedAt, language)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="detail-file-note">
        <HardDrive size={16} />
        <p>{t('file.sessionOnly')} {t('settings.backupHelp')}</p>
      </div>

      {renaming && (
        <RenameDocumentModal
          document={document}
          onClose={() => setRenaming(false)}
          onSave={(title) => {
            store.updateDocument(document.id, { title })
            toast(t('toast.saved'), 'success')
          }}
        />
      )}

      {groupPicker && (
        <ChooseGroupModal
          kind={groupPicker}
          documentIds={[document.id]}
          onClose={() => setGroupPicker(null)}
          onDone={() => toast(t('toast.documentsAdded', { count: 1 }), 'success')}
        />
      )}
    </div>
  )
}
