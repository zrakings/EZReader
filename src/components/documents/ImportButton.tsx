import { Plus } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import { useImportDocuments } from '../../hooks/useImportDocuments'
import { pickFiles } from '../../services/fileHandler/picker'

export function ImportButton({
  className = 'button button-primary',
  label,
  compact = false,
}: {
  className?: string
  label?: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const { importFiles, busy } = useImportDocuments()

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        const entries = await pickFiles({ multiple: true })
        if (entries.length) await importFiles(entries)
      }}
    >
      <Plus size={17} />
      {!compact && (label ?? t('topbar.importDocument'))}
    </button>
  )
}
