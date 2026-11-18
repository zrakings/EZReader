import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Layers,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { fileRegistry, store } from '../services/storage/store'
import type { DocumentMeta } from '../types'
import { resolveGroupCover } from '../utils/groupCover'
import { AddToGroupModal } from '../components/documents/AddToGroupModal'
import { ChooseGroupModal } from '../components/documents/ChooseGroupModal'
import { DocumentCard } from '../components/documents/DocumentCard'
import { GroupFormModal } from '../components/collections/GroupFormModal'
import { RenameDocumentModal } from '../components/common/RenameDocumentModal'
import { Cover } from '../components/common/Cover'
import { EmptyState } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function SeriesDetailPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [renameDocument, setRenameDocument] = useState<DocumentMeta | null>(null)
  const [groupPicker, setGroupPicker] = useState<{ kind: 'collection' | 'series'; ids: string[] } | null>(null)

  const series = state.series.find((item) => item.id === id)
  const documents = useMemo(() => {
    if (!series) return []
    return series.documentIds
      .map((docId) => state.documents.find((doc) => doc.id === docId))
      .filter((doc): doc is DocumentMeta => Boolean(doc))
  }, [series, state.documents])

  if (!series) {
    return (
      <div className="page">
        <EmptyState
          icon={<Layers size={30} />}
          title={t('series.notFound')}
          text={t('series.emptyText')}
          action={
            <Link className="button button-primary" to="/series">
              {t('nav.series')}
            </Link>
          }
        />
      </div>
    )
  }

  const cover = resolveGroupCover(series, documents, state.covers)
  const nextVolume =
    documents.find((doc) => doc.progress > 0 && doc.progress < 0.995) ??
    documents.find((doc) => !doc.completedAt && doc.progress < 0.995) ??
    documents[0]
  const completeCount = documents.filter((doc) => doc.completedAt || doc.progress >= 0.995).length
  const allComplete = documents.length > 0 && completeCount === documents.length

  const requestDelete = async () => {
    const ok = await confirm({
      title: t('series.deleteTitle'),
      description: t('series.deleteText', { name: series.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteSeries(series.id)
    toast(t('toast.seriesDeleted'), 'success')
    navigate('/series')
  }

  const removeFromSeries = (document: DocumentMeta) => {
    store.removeDocumentsFromSeries(series.id, [document.id])
    toast(t('toast.documentsRemoved', { count: 1 }), 'success')
  }

  const removeFromLibrary = async (document: DocumentMeta) => {
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
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (!series || target < 0 || target >= series.documentIds.length) return
    const ids = [...series.documentIds]
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    store.reorderSeries(series.id, ids)
  }

  return (
    <div className="page group-detail-page">
      <div className="detail-back-row">
        <Link to="/series" className="back-link">
          <ArrowLeft size={16} />
          {t('nav.series')}
        </Link>
      </div>

      <header className="group-detail-header">
        <div className="group-detail-cover">
          <Cover
            src={cover.src}
            title={series.name}
            format={cover.format}
            showFormat={false}
            className="group-detail-cover-image"
          />
        </div>
        <div className="group-detail-copy">
          <span className="eyebrow">
            <Layers size={14} />
            {t('series.title')}
          </span>
          <h1>{series.name}</h1>
          {series.description && <p>{series.description}</p>}
          <div className="group-detail-meta">
            <span>{t('series.volumes', { count: documents.length })}</span>
            <span>·</span>
            <span>
              {allComplete ? t('series.finished') : `${completeCount}/${documents.length} ${t('reader.completed').toLowerCase()}`}
            </span>
          </div>
          <div className="group-detail-actions">
            {nextVolume && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  if (allComplete) {
                    toast(t('series.finished'), 'success')
                    return
                  }
                  navigate(`/read/${nextVolume.id}`)
                }}
              >
                <Play size={16} />
                {documents.some((doc) => doc.progress > 0) ? t('series.continue') : t('series.startSeries')}
              </button>
            )}
            <button type="button" className="button button-ghost" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {t('series.addVolume')}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              {t('common.edit')}
            </button>
            <button type="button" className="button button-ghost danger-text" onClick={() => void requestDelete()}>
              <Trash2 size={16} />
              {t('common.delete')}
            </button>
          </div>
        </div>
      </header>

      {documents.length === 0 ? (
        <EmptyState
          icon={<ListPlus size={30} />}
          title={t('series.emptyVolumes')}
          text={t('series.emptyVolumesText')}
          action={
            <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {t('series.addVolume')}
            </button>
          }
        />
      ) : (
        <section className="series-volumes">
          <div className="series-volumes-head">
            <div>
              <h2>{t('series.volumesTitle')}</h2>
              <p>{t('series.reorderHint')}</p>
            </div>
            <span className="series-next-chip">
              <ArrowRight size={14} />
              {allComplete ? t('series.finished') : t('series.nextUp')}: {nextVolume?.title ?? '—'}
            </span>
          </div>

          <div className="series-volume-list">
            {documents.map((doc, index) => {
              const isNext = nextVolume?.id === doc.id && !allComplete
              return (
                <div className={`series-volume-row ${isNext ? 'is-next' : ''}`} key={doc.id}>
                  <div className="series-order">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div className="series-order-buttons">
                      <button
                        type="button"
                        className="icon-button tiny"
                        disabled={index === 0}
                        aria-label={t('series.moveUp')}
                        title={t('series.moveUp')}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button tiny"
                        disabled={index === documents.length - 1}
                        aria-label={t('series.moveDown')}
                        title={t('series.moveDown')}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="series-volume-card">
                    <DocumentCard
                      document={doc}
                      view="list"
                      onOpen={() => navigate(`/read/${doc.id}`)}
                      onDetails={() => navigate(`/document/${doc.id}`)}
                      onRename={() => setRenameDocument(doc)}
                      onRemove={() => void removeFromLibrary(doc)}
                      onFavorite={() => {
                        store.toggleFavorite(doc.id)
                        toast(doc.favorite ? t('toast.favoriteRemoved') : t('toast.favoriteAdded'), 'success')
                      }}
                      onAddToCollection={() => setGroupPicker({ kind: 'collection', ids: [doc.id] })}
                      onAddToSeries={() => setGroupPicker({ kind: 'series', ids: [doc.id] })}
                    />
                  </div>
                  <div className="series-volume-actions">
                    {isNext && (
                      <span className="next-badge">
                        <BookOpen size={13} />
                        {t('series.nextUp')}
                      </span>
                    )}
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => removeFromSeries(doc)}
                      title={t('series.removeVolume')}
                    >
                      <X size={14} />
                      {t('series.removeVolume')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {adding && (
        <AddToGroupModal
          title={t('series.addVolume')}
          subtitle={series.name}
          documents={state.documents}
          alreadyAddedIds={series.documentIds}
          onAdd={(ids) => {
            store.addDocumentsToSeries(series.id, ids)
            toast(t('toast.documentsAdded', { count: ids.length }), 'success')
          }}
          onClose={() => setAdding(false)}
          addLabel={t('common.add')}
        />
      )}

      {editing && (
        <GroupFormModal
          kind="series"
          initial={series}
          documents={documents}
          covers={state.covers}
          onClose={() => setEditing(false)}
          onSave={(values) => {
            store.updateSeries(series.id, values)
            setEditing(false)
            toast(t('toast.seriesUpdated'), 'success')
          }}
        />
      )}

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
