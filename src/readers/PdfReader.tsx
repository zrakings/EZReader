import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCw,
  Search as SearchIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useAppSelector, useI18n } from '../hooks/useAppStore'
import { loadPdfDocument } from '../services/fileHandler/pdf'
import { store } from '../services/storage/store'
import type { ReaderLocation } from '../types'
import { clamp, errorMessage, isEditableElement, readerLocation } from '../utils/format'
import { ReaderAppearancePanel } from './ReaderAppearancePanel'
import { ReaderShell } from './ReaderShell'
import type { ReaderProps, TocEntry } from './types'
import { useReaderProgress } from './useReaderProgress'

interface SearchResult {
  page: number
  snippet: string
  offset: number
}

const MAX_SEARCH_RESULTS = 200

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 48)
  const end = Math.min(text.length, index + length + 72)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

async function resolveOutlinePage(pdf: PDFDocumentProxy, destination: unknown): Promise<number | null> {
  let resolved: unknown = destination
  if (typeof destination === 'string') {
    resolved = await pdf.getDestination(destination)
  }
  if (!Array.isArray(resolved) || !resolved.length) return null
  const target = resolved[0]
  if (typeof target === 'number') return target + 1
  if (typeof target === 'object' && target !== null) {
    try {
      return (await pdf.getPageIndex(target as Parameters<PDFDocumentProxy['getPageIndex']>[0])) + 1
    } catch {
      return null
    }
  }
  if (typeof target === 'string') {
    try {
      const nested = await pdf.getDestination(target)
      if (Array.isArray(nested) && typeof nested[0] === 'number') return nested[0] + 1
    } catch {
      return null
    }
  }
  return null
}

function startPageFor(doc: ReaderProps['doc'], initialLocation: ReaderLocation | null): number {
  const preferred =
    initialLocation &&
    (initialLocation.type === 'pdf-page' || typeof initialLocation.page === 'number')
      ? initialLocation.page ?? Number(initialLocation.value)
      : doc.lastPage
  return Math.max(1, Math.round(Number(preferred) || 1))
}

export function PdfReader({ doc, file, initialLocation, onClose }: ReaderProps) {
  const { t } = useI18n()
  const readerSettings = useAppSelector((state) => state.settings.reader)
  const report = useReaderProgress(doc)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(() => startPageFor(doc, initialLocation))
  const [rotation, setRotation] = useState(0)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pageInput, setPageInput] = useState(String(startPageFor(doc, initialLocation)))
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null)
  const searchRun = useRef(0)
  const startPageRef = useRef(startPageFor(doc, initialLocation))
  const translateRef = useRef(t)
  translateRef.current = t

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    setLoading(true)
    setError('')
    setPdf(null)
    setNumPages(0)

    const open = async () => {
      try {
        const data = await file.arrayBuffer()
        const document = await loadPdfDocument(data)
        if (cancelled) {
          void document.destroy()
          return
        }
        loaded = document
        setPdf(document)
        setNumPages(document.numPages)
        const target = clamp(startPageRef.current, 1, document.numPages)
        setPage(target)
        setPageInput(String(target))
        setLoading(false)

        try {
          const outline = await document.getOutline()
          if (cancelled || !outline?.length) return
          const entries: TocEntry[] = []
          const walk = async (
            items: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>,
            depth: number,
          ) => {
            for (const item of items) {
              const pageNumber = await resolveOutlinePage(document, item.dest)
              if (pageNumber) {
                entries.push({
                  label: item.title || translateRef.current('common.unknown'),
                  depth,
                  location: readerLocation(
                    'pdf-page',
                    pageNumber,
                    pageNumber / document.numPages,
                    translateRef.current('reader.pageOf', {
                      page: pageNumber,
                      total: document.numPages,
                    }),
                    pageNumber,
                  ),
                })
              }
              if (item.items?.length) await walk(item.items, depth + 1)
              if (cancelled) return
            }
          }
          await walk(outline, 0)
          if (!cancelled) setToc(entries)
        } catch {
          // A broken outline should never prevent reading the document.
        }
      } catch (issue) {
        if (!cancelled) {
          setError(errorMessage(issue, translateRef.current('reader.errorText')))
          setLoading(false)
        }
      }
    }

    void open()
    return () => {
      cancelled = true
      if (loaded) void loaded.destroy()
    }
  }, [attempt, file])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const measure = () => {
      setStageSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pdf || !canvasRef.current || !stageSize.width || !stageSize.height) return
    let cancelled = false
    setRendering(true)
    setRenderError('')

    const render = async () => {
      try {
        const current = await pdf.getPage(clamp(page, 1, pdf.numPages))
        if (cancelled || !canvasRef.current) return
        const baseViewport = current.getViewport({ scale: 1, rotation })
        const padding = 36
        const availableWidth = Math.max(120, stageSize.width - padding)
        const availableHeight = Math.max(120, stageSize.height - padding)
        const preset = readerSettings.pdfZoomPreset
        let scale =
          preset === 'fit-width'
            ? availableWidth / baseViewport.width
            : preset === 'fit-page'
              ? Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height)
              : 1
        scale = clamp(scale * readerSettings.pdfZoom, 0.1, 8)

        const cssViewport = current.getViewport({ scale, rotation })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const renderViewport = current.getViewport({ scale: scale * ratio, rotation })
        const canvas = canvasRef.current
        canvas.width = Math.max(1, Math.ceil(renderViewport.width))
        canvas.height = Math.max(1, Math.ceil(renderViewport.height))
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('Canvas rendering is not available.')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        renderTaskRef.current?.cancel()
        const task = current.render({ canvasContext: context, viewport: renderViewport })
        renderTaskRef.current = task
        await task.promise
        if (!cancelled) setRendering(false)
      } catch (issue) {
        if (cancelled || (issue instanceof Error && issue.name === 'RenderingCancelledException')) return
        setRenderError(errorMessage(issue, t('reader.errorText')))
        setRendering(false)
      }
    }

    void render()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [page, pdf, rotation, readerSettings.pdfZoom, readerSettings.pdfZoomPreset, stageSize, t])

  const pageLocation = useMemo(
    () =>
      readerLocation(
        'pdf-page',
        page,
        numPages ? page / numPages : 0,
        t('reader.pageOf', { page, total: numPages || '—' }),
        page,
      ),
    [numPages, page, t],
  )

  useEffect(() => {
    if (!numPages) return
    report(pageLocation, numPages, true)
    setPageInput(String(page))
  }, [numPages, page, pageLocation, report])

  const goToPage = useCallback(
    (target: number) => {
      if (!numPages) return
      setPage((current) => {
        const next = clamp(Math.round(target), 1, numPages)
        return next === current ? current : next
      })
      setPageInput(String(clamp(Math.round(target), 1, numPages)))
    },
    [numPages],
  )

  const previous = useCallback(() => goToPage(page - 1), [goToPage, page])
  const next = useCallback(() => goToPage(page + 1), [goToPage, page])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        previous()
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        next()
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        store.updateReaderSettings({ pdfZoom: clamp(readerSettings.pdfZoom * 1.2, 0.25, 5) })
      } else if (event.key === '-') {
        event.preventDefault()
        store.updateReaderSettings({ pdfZoom: clamp(readerSettings.pdfZoom / 1.2, 0.25, 5) })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, previous, readerSettings.pdfZoom])

  useEffect(() => {
    return () => {
      searchRun.current += 1
    }
  }, [])

  const runSearch = async () => {
    const term = query.trim()
    if (!pdf || !term) return
    const run = ++searchRun.current
    setSearching(true)
    setSearched(true)
    setResults([])
    const lowered = term.toLocaleLowerCase()
    const found: SearchResult[] = []
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (run !== searchRun.current) return
        const current = await pdf.getPage(pageNumber)
        const content = await current.getTextContent()
        const text = content.items
          .map((item) => ('str' in item ? item.str : ' '))
          .join(' ')
          .replace(/\s+/g, ' ')
        const haystack = text.toLocaleLowerCase()
        let offset = haystack.indexOf(lowered)
        while (offset >= 0) {
          found.push({
            page: pageNumber,
            offset,
            snippet: snippetAround(text, offset, term.length),
          })
          if (found.length >= MAX_SEARCH_RESULTS) break
          offset = haystack.indexOf(lowered, offset + Math.max(1, lowered.length))
        }
        if (found.length >= MAX_SEARCH_RESULTS) break
        if (pageNumber % 6 === 0) await new Promise((resolve) => window.setTimeout(resolve, 0))
      }
      if (run === searchRun.current) setResults(found)
    } catch (issue) {
      if (run === searchRun.current) setRenderError(errorMessage(issue))
    } finally {
      if (run === searchRun.current) setSearching(false)
    }
  }

  const searchPanel = (
    <div className="reader-search">
      <form
        className="reader-search-form"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch()
        }}
      >
        <label className="search-input">
          <SearchIcon size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('reader.searchPlaceholder')}
            autoFocus
          />
        </label>
        <button type="submit" className="button button-primary button-small" disabled={!query.trim() || searching}>
          {searching ? <LoaderCircle size={15} className="spin" /> : t('common.search')}
        </button>
      </form>
      {searching && (
        <div className="reader-search-status">
          <LoaderCircle size={16} className="spin" />
          {t('reader.searching')}
        </div>
      )}
      {!searching && !searched && <div className="reader-panel-empty">{t('reader.searchHint')}</div>}
      {!searching && searched && results.length === 0 && (
        <div className="reader-panel-empty">{t('reader.searchEmpty')}</div>
      )}
      {results.length > 0 && (
        <>
          <div className="reader-search-count">
            {t('reader.searchResults', { count: results.length })}
            {results.length >= MAX_SEARCH_RESULTS ? '+' : ''}
          </div>
          <div className="reader-search-results">
            {results.map((result, index) => (
              <button
                type="button"
                key={`${result.page}-${result.offset}-${index}`}
                className="reader-search-result"
                onClick={() => goToPage(result.page)}
              >
                <span>{t('reader.page', { page: result.page })}</span>
                <p>{result.snippet}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  if (error) {
    return (
      <div className="reader-root reader-gate-root">
        <div className="reader-gate">
          <h1>{t('reader.errorTitle')}</h1>
          <p>{error}</p>
          <div className="reader-gate-actions">
            <button type="button" className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>
              {t('common.retry')}
            </button>
            <button type="button" className="button button-ghost" onClick={onClose}>
              {t('reader.backToLibrary')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ReaderShell
      doc={doc}
      location={numPages ? pageLocation : null}
      progress={numPages ? page / numPages : 0}
      toc={toc}
      onNavigate={(location) => {
        if (location.page) goToPage(location.page)
        else {
          const parsed = Number(location.value)
          if (Number.isFinite(parsed)) goToPage(parsed)
        }
      }}
      onClose={onClose}
      settings={<ReaderAppearancePanel variant="pdf" />}
      search={searchPanel}
      controls={
        <>
          <button type="button" className="reader-nav-button" onClick={previous} disabled={page <= 1} title={t('reader.previous')}>
            <ChevronLeft size={20} />
          </button>
          <form
            className="reader-page-form"
            onSubmit={(event) => {
              event.preventDefault()
              goToPage(Number(pageInput))
            }}
          >
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => goToPage(Number(pageInput))}
              inputMode="numeric"
              aria-label={t('reader.page', { page })}
            />
            <span>/ {numPages || '—'}</span>
          </form>
          <button type="button" className="reader-nav-button" onClick={next} disabled={page >= numPages} title={t('reader.next')}>
            <ChevronRight size={20} />
          </button>
          <span className="reader-control-divider" />
          <button
            type="button"
            className="reader-tool icon-only"
            onClick={() => store.updateReaderSettings({ pdfZoom: clamp(readerSettings.pdfZoom / 1.2, 0.25, 5) })}
            title={t('reader.zoomOut')}
          >
            <ZoomOut size={18} />
          </button>
          <span className="reader-zoom-label">{Math.round(readerSettings.pdfZoom * 100)}%</span>
          <button
            type="button"
            className="reader-tool icon-only"
            onClick={() => store.updateReaderSettings({ pdfZoom: clamp(readerSettings.pdfZoom * 1.2, 0.25, 5) })}
            title={t('reader.zoomIn')}
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className="reader-tool icon-only"
            onClick={() => setRotation((value) => (value + 90) % 360)}
            title={t('reader.rotate')}
          >
            <RotateCw size={18} />
          </button>
        </>
      }
    >
      <div className="pdf-reader">
        <div className="pdf-scroll" ref={stageRef}>
          <div className="pdf-canvas-wrap">
            <canvas ref={canvasRef} className="pdf-canvas" />
            {(loading || rendering) && (
              <div className="reader-loading-overlay">
                <LoaderCircle size={26} className="spin" />
                <span>{loading ? t('reader.loadingDocument') : t('common.loading')}</span>
              </div>
            )}
            {renderError && <div className="reader-inline-error">{renderError}</div>}
          </div>
        </div>
      </div>
    </ReaderShell>
  )
}
