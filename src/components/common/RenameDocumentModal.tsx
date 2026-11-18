import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import type { DocumentMeta } from '../../types'
import { Modal } from './Modal'

export function RenameDocumentModal({
  document,
  onSave,
  onClose,
}: {
  document: DocumentMeta
  onSave: (title: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(document.title)

  return (
    <Modal
      title={t('library.renameTitle')}
      onClose={onClose}
      size="small"
      closeLabel={t('common.close')}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!title.trim()}
            onClick={() => {
              onSave(title.trim())
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{t('library.renameTitle')}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          maxLength={180}
        />
      </label>
      <div className="notice notice-muted">
        <AlertTriangle size={16} />
        <p>{t('library.renameHelp')}</p>
      </div>
    </Modal>
  )
}
