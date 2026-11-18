import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { Series } from '../types'
import { GroupCard } from '../components/collections/GroupCard'
import { GroupFormModal } from '../components/collections/GroupFormModal'
import { EmptyState, PageHeader } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

export function SeriesPage() {
  const { t } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Series | null>(null)

  const requestDelete = async (series: Series) => {
    const ok = await confirm({
      title: t('series.deleteTitle'),
      description: t('series.deleteText', { name: series.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    store.deleteSeries(series.id)
    toast(t('toast.seriesDeleted'), 'success')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('nav.organize')}
        title={t('series.title')}
        subtitle={t('series.subtitle')}
        actions={
          <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            {t('series.create')}
          </button>
        }
      />

      {state.series.length === 0 ? (
        <EmptyState
          icon={<Layers size={30} />}
          title={t('series.empty')}
          text={t('series.emptyText')}
          action={
            <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              {t('series.create')}
            </button>
          }
        />
      ) : (
        <div className="group-grid">
          {state.series.map((series) => (
            <GroupCard
              key={series.id}
              group={series}
              kind="series"
              onOpen={() => navigate(`/series/${series.id}`)}
              onEdit={() => setEditing(series)}
              onDelete={() => void requestDelete(series)}
            />
          ))}
        </div>
      )}

      {creating && (
        <GroupFormModal
          kind="series"
          documents={state.documents}
          covers={state.covers}
          onClose={() => setCreating(false)}
          onSave={(values) => {
            store.createSeries(values)
            setCreating(false)
            toast(t('toast.seriesCreated'), 'success')
          }}
        />
      )}

      {editing && (
        <GroupFormModal
          kind="series"
          initial={editing}
          documents={state.documents.filter((doc) => editing.documentIds.includes(doc.id))}
          covers={state.covers}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            store.updateSeries(editing.id, values)
            setEditing(null)
            toast(t('toast.seriesUpdated'), 'success')
          }}
        />
      )}
    </div>
  )
}
