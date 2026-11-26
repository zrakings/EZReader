import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LoaderCircle, Upload } from 'lucide-react'
import type { DocumentMeta, FileEntry, ImportResult } from '../types'
import { createCoverForFile } from '../services/fileHandler/coverService'
import { inspectFile } from '../services/fileHandler/inspect'
import { saveFile } from '../services/storage/fileStore'
import { fileRegistry, store } from '../services/storage/store'
import { errorMessage, extensionOf, formatLabel, uid } from '../utils/format'
import { useUI } from '../components/common/UIProvider'
import { useI18n } from './useAppStore'

interface ImportProgress {
  active: boolean
  current: number
  total: number
  name: string
}

interface ImportContextValue {
  importFiles: (entries: FileEntry[]) => Promise<ImportResult>
  busy: boolean
  progress: ImportProgress
}

const ImportContext = createContext<ImportContextValue | null>(null)

export function ImportProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { toast } = useUI()
  const [progress, setProgress] = useState<ImportProgress>({
    active: false,
    current: 0,
    total: 0,
    name: '',
  })

  const importFiles = useCallback(
    async (entries: FileEntry[]): Promise<ImportResult> => {
      if (!entries.length) return { added: [], skipped: [] }
      if (progress.active) {
        toast(t('import.processing', { current: progress.current, total: progress.total }), 'info')
        return { added: [], skipped: [] }
      }

      const added: DocumentMeta[] = []
      const skipped: ImportResult['skipped'] = []
      const existing = store.getState().documents
      const known = new Set(existing.map((doc) => `${doc.fileName.toLowerCase()}::${doc.size}`))

      setProgress({ active: true, current: 0, total: entries.length, name: entries[0]?.file.name ?? '' })

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]
        const file = entry.file
        setProgress({ active: true, current: index + 1, total: entries.length, name: file.name })
        const duplicateKey = `${file.name.toLowerCase()}::${file.size}`
        if (known.has(duplicateKey)) {
          skipped.push({ fileName: file.name, reason: 'duplicate' })
          toast(t('import.duplicate', { name: file.name }), 'warning')
          continue
        }

        try {
          const inspection = await inspectFile(file)
          if (inspection.warning) toast(inspection.warning, 'warning')
          const title = inspection.title || file.name
          const { cover, totalPages } = await createCoverForFile(file, inspection, title)
          const now = new Date().toISOString()
          const document: DocumentMeta = {
            id: uid('doc'),
            fileName: file.name,
            title,
            format: inspection.format,
            extension: extensionOf(file.name) || inspection.extension,
            mimeType: inspection.mimeType,
            size: file.size,
            lastModified: file.lastModified,
            addedAt: now,
            lastOpenedAt: null,
            progress: 0,
            lastPage: 0,
            totalPages,
            furthestPage: 0,
            lastLocation: null,
            favorite: false,
            completedAt: null,
          }
          fileRegistry.set(document.id, entry)
          if (store.getState().settings.keepFiles) {
            const stored = await saveFile(document, entry)
            if (!stored) toast(t('file.storageWarning'), 'warning')
          }
          store.addDocuments([document], { [document.id]: cover })
          known.add(duplicateKey)
          added.push(document)
          toast(
            t('import.added', {
              title: document.title,
              format: formatLabel(document.format, document.extension),
            }),
            'success',
          )
        } catch (error) {
          const reason = errorMessage(error)
          skipped.push({ fileName: file.name, reason })
          toast(t('import.invalid', { name: file.name, reason }), 'error')
        }
      }

      setProgress({ active: false, current: entries.length, total: entries.length, name: '' })
      if (added.length > 1) {
        toast(t('import.summary', { added: added.length, skipped: skipped.length }), 'success')
      }
      return { added, skipped }
    },
    [progress.active, progress.current, progress.total, t, toast],
  )

  const value = useMemo(() => ({ importFiles, busy: progress.active, progress }), [importFiles, progress])

  return (
    <ImportContext.Provider value={value}>
      {children}
      {progress.active && (
        <div className="import-progress-card" role="status" aria-live="polite">
          <div className="import-progress-icon">
            <Upload size={18} />
            <LoaderCircle size={18} className="spin" />
          </div>
          <div>
            <strong>{t('import.processing', { current: progress.current, total: progress.total })}</strong>
            <span>{progress.name}</span>
          </div>
        </div>
      )}
    </ImportContext.Provider>
  )
}

export function useImportDocuments(): ImportContextValue {
  const context = useContext(ImportContext)
  if (!context) throw new Error('useImportDocuments must be used inside ImportProvider')
  return context
}
