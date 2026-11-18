import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { Collection } from '../types'
import { GroupCard } from '../components/collections/GroupCard'
import { GroupFormModal } from '../components/collections/GroupFormModal'
import { EmptyState, PageHeader } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function CollectionsPage() {
  const { t } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Collection | null>(null)

  const requestDelete = async (collection: Collection) => {
    const ok = await confirm({
      title: t('collections.deleteTitle'),
      description: t('collections.deleteText', { name: collection.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteCollection(collection.id)
    toast(t('toast.collectionDeleted'), 'success')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('nav.organize')}
        title={t('collections.title')}
        subtitle={t('collections.subtitle')}
        actions={
          <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            {t('collections.create')}
          </button>
        }
      />

      {state.collections.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={30} />}
          title={t('collections.empty')}
          text={t('collections.emptyText')}
          action={
            <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              {t('collections.create')}
            </button>
          }
        />
      ) : (
        <div className="group-grid">
          {state.collections.map((collection) => (
            <GroupCard
              key={collection.id}
              group={collection}
              kind="collection"
              onOpen={() => navigate(`/collections/${collection.id}`)}
              onEdit={() => setEditing(collection)}
              onDelete={() => void requestDelete(collection)}
            />
          ))}
        </div>
      )}

      {creating && (
        <GroupFormModal
          kind="collection"
          documents={state.documents}
          covers={state.covers}
          onClose={() => setCreating(false)}
          onSave={(values) => {
            store.createCollection(values)
            setCreating(false)
            toast(t('toast.collectionCreated'), 'success')
          }}
        />
      )}

      {editing && (
        <GroupFormModal
          kind="collection"
          initial={editing}
          documents={state.documents.filter((doc) => editing.documentIds.includes(doc.id))}
          covers={state.covers}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            store.updateCollection(editing.id, values)
            setEditing(null)
            toast(t('toast.collectionUpdated'), 'success')
          }}
        />
      )}
    </div>
  )
}
