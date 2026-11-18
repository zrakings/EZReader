import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import type { Note, ReaderLocation } from '../../types'
import { Modal } from './Modal'

interface NoteFormModalProps {
  initial?: Note | null
  location?: ReaderLocation | null
  onSave: (values: { title: string; content: string }) => void
  onClose: () => void
}

export function NoteFormModal({ initial, location, onSave, onClose }: NoteFormModalProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const currentLocation = initial?.location ?? location ?? null

  return (
    <Modal
      title={initial ? t('notes.edit') : t('notes.add')}
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!title.trim() || !content.trim()}
            onClick={() => {
              onSave({ title: title.trim(), content: content.trim() })
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{t('notes.noteTitle')}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('notes.noteTitlePlaceholder')}
          autoFocus
          maxLength={160}
        />
      </label>
      <label className="field">
        <span>{t('notes.content')}</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('notes.contentPlaceholder')}
          rows={7}
          maxLength={12000}
        />
      </label>
      {currentLocation && (
        <div className="notice notice-muted">
          <MapPin size={16} />
          <p>
            {t('reader.location')}: <strong>{currentLocation.label || t('common.unknown')}</strong>
          </p>
        </div>
      )}
    </Modal>
  )
}
