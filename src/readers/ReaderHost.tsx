import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileWarning, Link2, LoaderCircle } from 'lucide-react'
import { useAppState, useI18n, useIsFileAvailable } from '../hooks/useAppStore'
import { useReadingTimer } from '../hooks/useReadingTimer'
import { saveFile } from '../services/storage/fileStore'
import { fileRegistry, store } from '../services/storage/store'
import { matchFileToDocument, pickSingleFile } from '../services/fileHandler/picker'
import type { DocumentCategory, DocumentMeta } from '../types'
import {
  categoryOf,
  errorMessage,
  formatBytes,
  formatLabel,
  parseLocationParam,
} from '../utils/format'
import { useUI } from '../components/common/UIProvider'
import { ComicReader } from './ComicReader'
import { EpubReader } from './EpubReader'
import { PdfReader } from './PdfReader'
import { TextReader } from './TextReader'

export function ReaderHost() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const state = useAppState()
  const { toast, confirm } = useUI()
  const doc = state.documents.find((item) => item.id === id)
  const available = useIsFileAvailable(id ?? '')
  const openedRef = useRef('')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const locParam = params.get('loc')
  const initialLocation = parseLocationParam(locParam) ?? doc?.lastLocation ?? null

  useReadingTimer(Boolean(doc && available))

  useEffect(() => {
    if (!doc || !available) return
    if (openedRef.current === doc.id) return
    openedRef.current = doc.id
    store.markOpened(doc.id)
  }, [doc, available])

  const close = useCallback(() => {
    navigate('/library')
  }, [navigate])

  const locateFile = async (target: DocumentMeta) => {
    setError('')
    setLocating(true)
    try {
      const entry = await pickSingleFile(target.extension)
      if (!entry) {
        toast(t('file.cancelled'), 'info')
        return
      }
      const match = matchFileToDocument(entry.file, target)
      if (!match.exact) {
        const ok = await confirm({
          title: t('file.locateTitle'),
          description: `${t('file.matchWarning')} ${t('file.expected', {
            name: target.fileName,
            size: formatBytes(target.size),
          })}`,
          confirmLabel: t('file.useAnyway'),
        })
        if (!ok) return
      }
      fileRegistry.set(target.id, entry)
      if (store.getState().settings.keepFiles) {
        const stored = await saveFile(target, entry)
        toast(
          stored ? t('file.matchStored') : t('file.storageWarning'),
          stored ? 'success' : 'warning',
        )
      } else {
        toast(t('file.matchGood'), 'success')
      }
    } catch (issue) {
      setError(errorMessage(issue))
    } finally {
      setLocating(false)
    }
  }

  if (!doc) {
    return (
      <div className="reader-root reader-gate-root">
        <div className="reader-gate">
          <div className="reader-gate-icon">
            <FileWarning size={34} />
          </div>
          <h1>{t('reader.errorTitle')}</h1>
          <p>{t('library.emptyText')}</p>
          <button type="button" className="button button-primary" onClick={close}>
            <ArrowLeft size={16} />
            {t('reader.backToLibrary')}
          </button>
        </div>
      </div>
    )
  }

  if (!available) {
    return (
      <div className="reader-root reader-gate-root">
        <header className="reader-gate-topbar">
          <button type="button" className="reader-back" onClick={close}>
            <ArrowLeft size={18} />
            <span>{t('reader.backToLibrary')}</span>
          </button>
          <strong>{doc.title}</strong>
        </header>
        <div className="reader-gate">
          <div className="reader-gate-icon">
            <FileWarning size={34} />
          </div>
          <span className="eyebrow">{t('reader.noFile')}</span>
          <h1>{t('file.locateFor', { title: doc.title })}</h1>
          <p>{t('reader.noFileText')}</p>
          <div className="reader-gate-file">
            <div>
              <strong>{doc.fileName}</strong>
              <span>
                {formatLabel(doc.format, doc.extension)} · {formatBytes(doc.size)}
              </span>
            </div>
            {doc.lastLocation && (
              <div>
                <small>{t('reader.currentLocation')}</small>
                <span>{doc.lastLocation.label}</span>
              </div>
            )}
          </div>
          <div className="reader-gate-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void locateFile(doc)}
              disabled={locating}
            >
              {locating ? <LoaderCircle size={16} className="spin" /> : <Link2 size={16} />}
              {t('reader.locateNow')}
            </button>
            <button type="button" className="button button-ghost" onClick={close}>
              {t('reader.backToLibrary')}
            </button>
          </div>
          <small className="reader-gate-hint">{t('file.locateText')}</small>
          {error && (
            <div className="notice notice-error">
              <AlertTriangle size={16} />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const entry = fileRegistry.get(doc.id)
  if (!entry) {
    // A render race can happen while the registry notification is in flight.
    return (
      <div className="reader-root reader-gate-root">
        <div className="reader-gate">
          <LoaderCircle size={30} className="spin" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  const category: DocumentCategory = categoryOf(doc.format)
  const key = `${doc.id}:${locParam ?? 'last'}`
  const props = {
    doc,
    file: entry.file,
    initialLocation,
    onClose: close,
  }

  return (
    <div className="reader-route" key={key}>
      {category === 'pdf' && <PdfReader {...props} />}
      {category === 'epub' && <EpubReader {...props} />}
      {category === 'text' && <TextReader {...props} />}
      {(category === 'comic' || category === 'image') && <ComicReader {...props} />}
    </div>
  )
}
