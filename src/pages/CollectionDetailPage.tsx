import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckSquare,
  FolderKanban,
  FolderPlus,
  ListPlus,
  Pencil,
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

export function CollectionDetailPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renameDocument, setRenameDocument] = useState<DocumentMeta | null>(null)
  const [groupPicker, setGroupPicker] = useState<{ kind: 'collection' | 'series'; ids: string[] } | null>(null)

  const collection = state.collections.find((item) => item.id === id)
  const documents = useMemo(() => {
    if (!collection) return []
    return collection.documentIds
      .map((docId) => state.documents.find((doc) => doc.id === docId))
      .filter((doc): doc is DocumentMeta => Boolean(doc))
  }, [collection, state.documents])

  useEffect(() => {
    setSelected(new Set())
    setSelectionMode(false)
  }, [id])

  if (!collection) {
    return (
      <div className="page">
        <EmptyState
          icon={<FolderKanban size={30} />}
          title={t('collections.notFound')}
          text={t('collections.emptyText')}
          action={
            <Link className="button button-primary" to="/collections">
              {t('nav.collections')}
            </Link>
          }
        />
      </div>
    )
  }

  const cover = resolveGroupCover(collection, documents, state.covers)

  const requestDelete = async () => {
    const ok = await confirm({
      title: t('collections.deleteTitle'),
      description: t('collections.deleteText', { name: collection.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteCollection(collection.id)
    toast(t('toast.collectionDeleted'), 'success')
    navigate('/collections')
  }

  const removeFromCollection = (ids: string[]) => {
    if (!ids.length) return
    store.removeDocumentsFromCollection(collection.id, ids)
    setSelected(new Set())
    setSelectionMode(false)
    toast(t('toast.documentsRemoved', { count: ids.length }), 'success')
  }

  const removeFromLibrary = async (doc: DocumentMeta) => {
    const ok = await confirm({
      title: t('card.deleteConfirmTitle'),
      description: t('card.deleteConfirmText', { title: doc.title }),
      confirmLabel: t('common.remove'),
      danger: true,
    })
    if (!ok) return
    fileRegistry.remove(doc.id)
    store.removeDocuments([doc.id])
    toast(t('toast.libraryRemoved'), 'success')
  }

  return (
    <div className="page group-detail-page">
      <div className="detail-back-row">
        <Link to="/collections" className="back-link">
          <ArrowLeft size={16} />
          {t('nav.collections')}
        </Link>
      </div>

      <header className="group-detail-header">
        <div className="group-detail-cover">
          <Cover
            src={cover.src}
            title={collection.name}
            format={cover.format}
            showFormat={false}
            className="group-detail-cover-image"
          />
        </div>
        <div className="group-detail-copy">
          <span className="eyebrow">
            <FolderKanban size={14} />
            {t('collections.title')}
          </span>
          <h1>{collection.name}</h1>
          {collection.description && <p>{collection.description}</p>}
          <div className="group-detail-meta">
            <span>{t('collections.documents', { count: documents.length })}</span>
            <span>·</span>
            <span>{new Date(collection.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="group-detail-actions">
            <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {t('collections.addDocuments')}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              {t('common.edit')}
            </button>
            <button
              type="button"
              className={`button button-ghost ${selectionMode ? 'is-active' : ''}`}
              onClick={() => {
                setSelectionMode((value) => !value)
                setSelected(new Set())
              }}
            >
              <CheckSquare size={16} />
              {selectionMode ? t('common.done') : t('library.select')}
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
          icon={<FolderPlus size={30} />}
          title={t('collections.emptyDetail')}
          text={t('collections.emptyDetailText')}
          action={
            <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {t('collections.addDocuments')}
            </button>
          }
        />
      ) : (
        <>
          {selectionMode && (
            <div className="detail-selection-bar">
              <span>{t('library.selected', { count: selected.size })}</span>
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
                  {selected.size === documents.length ? t('library.deselectAll') : t('library.selectAll')}
                </button>
                <button
                  type="button"
                  className="button button-danger button-small"
                  disabled={selected.size === 0}
                  onClick={() => removeFromCollection(Array.from(selected))}
                >
                  <Trash2 size={15} />
                  {t('collections.removeFrom')}
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
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className={`library-collection view-${state.settings.defaultView}`}>
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                view={state.settings.defaultView}
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
                onRemove={() => void removeFromLibrary(doc)}
                onFavorite={() => {
                  store.toggleFavorite(doc.id)
                  toast(doc.favorite ? t('toast.favoriteRemoved') : t('toast.favoriteAdded'), 'success')
                }}
                onAddToCollection={() => setGroupPicker({ kind: 'collection', ids: [doc.id] })}
                onAddToSeries={() => setGroupPicker({ kind: 'series', ids: [doc.id] })}
              />
            ))}
          </div>
        </>
      )}

      {adding && (
        <AddToGroupModal
          title={t('collections.addDocuments')}
          subtitle={collection.name}
          documents={state.documents}
          alreadyAddedIds={collection.documentIds}
          onAdd={(ids) => {
            store.addDocumentsToCollection(collection.id, ids)
            toast(t('toast.documentsAdded', { count: ids.length }), 'success')
          }}
          onClose={() => setAdding(false)}
          addLabel={t('common.add')}
        />
      )}

      {editing && (
        <GroupFormModal
          kind="collection"
          initial={collection}
          documents={documents}
          covers={state.covers}
          onClose={() => setEditing(false)}
          onSave={(values) => {
            store.updateCollection(collection.id, values)
            setEditing(false)
            toast(t('toast.collectionUpdated'), 'success')
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
