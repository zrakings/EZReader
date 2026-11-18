import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ePub, { type Book, type Contents, type NavItem, type Rendition } from 'epubjs'
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Minus,
  Plus,
  Search as SearchIcon,
} from 'lucide-react'
import { useAppSelector, useI18n } from '../hooks/useAppStore'
import type { ReaderLocation } from '../types'
import { clamp, errorMessage, isEditableElement } from '../utils/format'
import { ReaderAppearancePanel } from './ReaderAppearancePanel'
import { ReaderShell } from './ReaderShell'
import type { ReaderProps, TocEntry } from './types'
import { useReaderProgress } from './useReaderProgress'

interface EpubSearchResult {
  cfi: string
  excerpt: string
  label: string
}

interface FlatTocItem {
  label: string
  href: string
  depth: number
}

const BACKGROUNDS = {
  dark: { background: '#12161c', text: '#e9e6de', muted: '#9ba4ae', accent: '#72d8c0' },
  black: { background: '#000000', text: '#e5e2da', muted: '#8b929a', accent: '#72d8c0' },
  sepia: { background: '#f2e8d5', text: '#3d3325', muted: '#7c705d', accent: '#0f7a68' },
  light: { background: '#fbfaf7', text: '#25231f', muted: '#6c6a64', accent: '#0b7a68' },
} as const

const FONT_STACKS = {
  serif: 'Lora, Georgia, "Times New Roman", serif',
  sans: 'Inter, "Segoe UI", system-ui, sans-serif',
  mono: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
} as const

const MAX_SEARCH_RESULTS = 200

function flattenToc(items: NavItem[], depth = 0, output: FlatTocItem[] = []): FlatTocItem[] {
  for (const item of items) {
    output.push({
      label: item.label?.trim() || '—',
      href: item.href,
      depth,
    })
    if (item.subitems?.length) flattenToc(item.subitems, depth + 1, output)
  }
  return output
}

function baseHref(href: string | undefined): string {
  return (href ?? '').split('#')[0]
}

function labelForHref(items: FlatTocItem[], href: string | undefined): string {
  const target = baseHref(href)
  if (!target) return ''
  const exact = items.find((item) => item.href === href)
  if (exact) return exact.label
  return items.find((item) => baseHref(item.href) === target)?.label ?? ''
}

export function EpubReader({ doc, file, initialLocation, onClose }: ReaderProps) {
  const { t } = useI18n()
  const readerSettings = useAppSelector((state) => state.settings.reader)
  const report = useReaderProgress(doc)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [current, setCurrent] = useState<ReaderLocation | null>(null)
  const [locationsReady, setLocationsReady] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<EpubSearchResult[]>([])
  const viewerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)
  const tocRef = useRef<FlatTocItem[]>([])
  const currentCfiRef = useRef('')
  const currentHrefRef = useRef('')
  const currentLocationRef = useRef<ReaderLocation | null>(null)
  const initialRef = useRef(initialLocation)
  const translateRef = useRef(t)
  const searchRun = useRef(0)
  translateRef.current = t

  const palette = BACKGROUNDS[readerSettings.background]
  const themeRef = useRef({ palette, settings: readerSettings })
  themeRef.current = { palette, settings: readerSettings }

  useEffect(() => {
    let cancelled = false
    let localBook: Book | null = null
    let localRendition: Rendition | null = null
    setLoading(true)
    setError('')
    setLocationsReady(false)
    setCurrent(null)
    setToc([])

    const open = async () => {
      try {
        const data = await file.arrayBuffer()
        const book = ePub(data)
        localBook = book
        bookRef.current = book
        await book.ready
        if (cancelled || !viewerRef.current) return

        const view = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
          allowScriptedContent: false,
          minSpreadWidth: 820,
        })
        localRendition = view
        renditionRef.current = view

        view.hooks.content.register((contents: Contents) => {
          const contentDocument = contents.document
          if (!contentDocument?.head) return
          const previous = contentDocument.getElementById('ezreader-style')
          previous?.remove()
          const style = contentDocument.createElement('style')
          style.id = 'ezreader-style'
          const theme = themeRef.current
          const font = FONT_STACKS[theme.settings.fontFamily]
          style.textContent = `
            html, body { background: ${theme.palette.background} !important; color: ${theme.palette.text} !important; }
            body { font-family: ${font} !important; font-size: ${theme.settings.fontSize}px !important; line-height: ${theme.settings.lineHeight} !important; }
            p, div, li, blockquote { line-height: ${theme.settings.lineHeight} !important; }
            a { color: ${theme.palette.accent} !important; }
            img, svg { max-width: 100% !important; height: auto !important; }
            ::selection { background: ${theme.palette.accent}55 !important; }
            h1, h2, h3, h4 { color: ${theme.palette.text} !important; }
          `
          contentDocument.head.appendChild(style)
          contents.document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (isEditableElement(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
              event.preventDefault()
              void renditionRef.current?.prev()
            } else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
              event.preventDefault()
              void renditionRef.current?.next()
            }
          })
        })

        view.on('relocated', (location: unknown) => {
          const typed = location as {
            start?: { cfi?: string; href?: string; percentage?: number; index?: number }
          }
          const start = typed.start
          if (!start?.cfi) return
          currentCfiRef.current = start.cfi
          currentHrefRef.current = start.href ?? ''
          const bookInstance = bookRef.current
          let percentage = Number(start.percentage) || 0
          let page: number | undefined
          let total = 0
          if (bookInstance && bookInstance.locations.length() > 0) {
            try {
              percentage = bookInstance.locations.percentageFromCfi(start.cfi)
              const index = bookInstance.locations.locationFromCfi(start.cfi) as unknown as number
              if (typeof index === 'number' && index >= 0) page = index + 1
              total = bookInstance.locations.length()
            } catch {
              // Fall back to the location percentage reported by epub.js.
            }
          }
          const label =
            labelForHref(tocRef.current, start.href) ||
            `${translateRef.current('reader.chapter')} ${(start.index ?? 0) + 1}`
          const next: ReaderLocation = {
            type: 'epub-cfi',
            value: start.cfi,
            percentage: clamp(percentage),
            label,
            ...(page ? { page } : {}),
          }
          currentLocationRef.current = next
          setCurrent(next)
          report(next, total)
        })

        try {
          await book.loaded.navigation
          const flat = flattenToc(book.navigation?.toc ?? [])
          tocRef.current = flat
          if (!cancelled) {
            setToc(
              flat.map((item) => ({
                label: item.label,
                depth: item.depth,
                location: {
                  type: 'epub-cfi',
                  value: item.href,
                  percentage: 0,
                  label: item.label,
                },
              })),
            )
          }
        } catch {
          // Missing navigation is survivable.
        }

        const initial = initialRef.current
        const target = initial && initial.type === 'epub-cfi' && initial.value ? initial.value : undefined
        await view.display(target)
        if (cancelled) return
        setRendition(view)
        setLoading(false)

        void book.locations
          .generate(1600)
          .then(() => {
            if (cancelled || !bookRef.current) return
            setLocationsReady(true)
            const cfi = currentCfiRef.current
            if (!cfi) return
            try {
              const percentage = bookRef.current.locations.percentageFromCfi(cfi)
              const index = bookRef.current.locations.locationFromCfi(cfi) as unknown as number
              const total = bookRef.current.locations.length()
              const base = currentLocationRef.current
              const next: ReaderLocation = {
                type: 'epub-cfi',
                value: cfi,
                percentage: clamp(percentage),
                label: base?.label ?? translateRef.current('reader.chapter'),
                ...(typeof index === 'number' && index >= 0 ? { page: index + 1 } : {}),
              }
              currentLocationRef.current = next
              setCurrent(next)
              report(next, total, true)
            } catch {
              // Ignore a CFI that locations could not map.
            }
          })
          .catch(() => {
            // Estimated locations are optional; reading still works without them.
          })
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
      searchRun.current += 1
      try {
        localRendition?.destroy()
      } catch {
        // The rendition may already be gone.
      }
      try {
        localBook?.destroy()
      } catch {
        // The book may already be gone.
      }
      renditionRef.current = null
      bookRef.current = null
    }
  }, [attempt, file, report])

  useEffect(() => {
    if (!rendition) return
    const font = FONT_STACKS[readerSettings.fontFamily]
    try {
      rendition.themes.override('color', palette.text, true)
      rendition.themes.override('background', palette.background, true)
      rendition.themes.override('font-family', font, true)
      rendition.themes.override('line-height', String(readerSettings.lineHeight), true)
      rendition.themes.fontSize(`${readerSettings.fontSize}px`)
    } catch {
      // Theme injection can fail while the rendition is being replaced.
    }
    const contents = rendition.getContents() as unknown
    const list = Array.isArray(contents) ? (contents as Contents[]) : contents ? [contents as Contents] : []
    for (const item of list) {
      try {
        const doc = item.document
        const style = doc.getElementById('ezreader-style')
        if (style) {
          const fontStack = FONT_STACKS[readerSettings.fontFamily]
          style.textContent = `
            html, body { background: ${palette.background} !important; color: ${palette.text} !important; }
            body { font-family: ${fontStack} !important; font-size: ${readerSettings.fontSize}px !important; line-height: ${readerSettings.lineHeight} !important; }
            p, div, li, blockquote { line-height: ${readerSettings.lineHeight} !important; }
            a { color: ${palette.accent} !important; }
            img, svg { max-width: 100% !important; height: auto !important; }
            ::selection { background: ${palette.accent}55 !important; }
            h1, h2, h3, h4 { color: ${palette.text} !important; }
          `
        }
      } catch {
        // Ignore transient content frames.
      }
    }
  }, [palette, readerSettings, rendition])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !rendition) return
    const resize = () => {
      try {
        rendition.resize(Math.max(200, stage.clientWidth), Math.max(200, stage.clientHeight))
      } catch {
        // epub.js can reject a resize while relocating.
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [rendition])

  const goToLocation = useCallback((location: ReaderLocation) => {
    if (!renditionRef.current) return
    if (location.type === 'epub-cfi' && location.value) {
      void renditionRef.current.display(location.value)
    }
  }, [])

  const previous = useCallback(() => {
    void renditionRef.current?.prev()
  }, [])

  const next = useCallback(() => {
    void renditionRef.current?.next()
  }, [])

  const jumpToPercentage = (percentage: number) => {
    const book = bookRef.current
    if (!book || !renditionRef.current || book.locations.length() === 0) return
    try {
      const cfi = book.locations.cfiFromPercentage(clamp(percentage))
      if (cfi) void renditionRef.current.display(cfi)
    } catch {
      // Ignore a percentage that falls outside generated locations.
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        previous()
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, previous])

  const runSearch = async () => {
    const term = query.trim()
    const book = bookRef.current
    if (!book || !term) return
    const run = ++searchRun.current
    setSearching(true)
    setSearched(true)
    setResults([])
    const found: EpubSearchResult[] = []
    const spine = book.spine as unknown as { length?: number; get: (index: number) => unknown }
    let length = Number(spine.length) || 0
    if (!length) {
      // Older builds do not expose spine.length; walk until get() stops returning.
      length = 0
      while (length < 5000 && book.spine.get(length)) length += 1
    }
    try {
      for (let index = 0; index < length; index += 1) {
        if (run !== searchRun.current) return
        const section = book.spine.get(index) as unknown as {
          load: (request?: unknown) => Promise<unknown>
          find: (query: string) => unknown
          unload: () => void
          href?: string
        } | null
        if (!section) continue
        try {
          await section.load(book.load.bind(book))
          const matches = section.find(term) as Array<{ cfi?: string; excerpt?: string }>
          if (Array.isArray(matches)) {
            for (const match of matches) {
              if (!match?.cfi) continue
              found.push({
                cfi: match.cfi,
                excerpt: match.excerpt?.replace(/\s+/g, ' ').trim() || term,
                label:
                  labelForHref(tocRef.current, section.href ?? currentHrefRef.current) ||
                  translateRef.current('reader.chapter'),
              })
              if (found.length >= MAX_SEARCH_RESULTS) break
            }
          }
        } finally {
          section.unload()
        }
        if (found.length >= MAX_SEARCH_RESULTS) break
        if (index % 3 === 0) await new Promise((resolve) => window.setTimeout(resolve, 0))
      }
      if (run === searchRun.current) setResults(found)
    } catch (issue) {
      if (run === searchRun.current) {
        setResults(found)
        console.warn('EZReader EPUB search stopped early', issue)
      }
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
                key={`${result.cfi}-${index}`}
                className="reader-search-result"
                onClick={() => {
                  if (renditionRef.current) void renditionRef.current.display(result.cfi)
                }}
              >
                <span>{result.label}</span>
                <p>{result.excerpt}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const progress = current?.percentage ?? 0
  const pageLabel = current?.label ?? t('reader.loadingDocument')
  const settingsPanel = useMemo(() => <ReaderAppearancePanel variant="text" />, [])

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
      location={current}
      progress={progress}
      toc={toc}
      onNavigate={goToLocation}
      onClose={onClose}
      settings={settingsPanel}
      search={searchPanel}
      controls={
        <>
          <button type="button" className="reader-nav-button" onClick={previous} title={t('reader.previous')}>
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="reader-nav-button"
            onClick={() => jumpToPercentage(progress - 0.05)}
            disabled={!locationsReady || progress <= 0.001}
            title={t('reader.previousChapter')}
          >
            <Minus size={18} />
          </button>
          <input
            className="reader-progress-range"
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            disabled={!locationsReady}
            onChange={(event) => jumpToPercentage(Number(event.target.value) / 1000)}
            aria-label={t('reader.progress')}
          />
          <button
            type="button"
            className="reader-nav-button"
            onClick={() => jumpToPercentage(progress + 0.05)}
            disabled={!locationsReady || progress >= 0.999}
            title={t('reader.nextChapter')}
          >
            <Plus size={18} />
          </button>
          <span className="reader-location-label" title={pageLabel}>
            {pageLabel}
          </span>
          <span className="reader-percent-label">{Math.round(progress * 100)}%</span>
          <button type="button" className="reader-nav-button" onClick={next} title={t('reader.next')}>
            <ChevronRight size={20} />
          </button>
        </>
      }
    >
      <div
        className="epub-reader"
        ref={stageRef}
        style={{ background: palette.background, color: palette.text }}
      >
        <div className="epub-viewer" ref={viewerRef} />
        {loading && (
          <div className="reader-loading-overlay">
            <LoaderCircle size={28} className="spin" />
            <span>{t('reader.loadingDocument')}</span>
          </div>
        )}
      </div>
    </ReaderShell>
  )
}
