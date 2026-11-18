import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import * as mammoth from 'mammoth'
import DOMPurify from 'dompurify'
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Search as SearchIcon,
} from 'lucide-react'
import { useAppSelector, useI18n } from '../hooks/useAppStore'
import type { ReaderLocation } from '../types'
import { clamp, errorMessage, escapeHtml, isEditableElement, readerLocation } from '../utils/format'
import { rtfToText } from '../utils/rtf'
import { ReaderAppearancePanel } from './ReaderAppearancePanel'
import { ReaderShell } from './ReaderShell'
import type { ReaderProps } from './types'
import { useReaderProgress } from './useReaderProgress'

interface TextSearchResult {
  offset: number
  snippet: string
}

const MAX_SEARCH_RESULTS = 200
const MAX_HIGHLIGHTS = 500

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

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 48)
  const end = Math.min(text.length, index + length + 72)
  return `${start > 0 ? '…' : ''}${text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim()}${end < text.length ? '…' : ''}`
}

function removeHighlights(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-ezreader-hit]')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    parent.replaceChild(window.document.createTextNode(mark.textContent ?? ''), mark)
    parent.normalize()
  })
}

function applyHighlights(container: HTMLElement, term: string): HTMLElement[] {
  if (!term) return []
  const lowered = term.toLocaleLowerCase()
  const walker = window.document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    const tag = parent?.tagName.toLowerCase()
    if (
      node.nodeValue?.trim() &&
      parent &&
      tag !== 'script' &&
      tag !== 'style' &&
      tag !== 'mark' &&
      tag !== 'textarea'
    ) {
      textNodes.push(node as Text)
    }
    node = walker.nextNode()
  }

  const marks: HTMLElement[] = []
  for (const textNode of textNodes) {
    if (marks.length >= MAX_HIGHLIGHTS) break
    const value = textNode.nodeValue ?? ''
    const haystack = value.toLocaleLowerCase()
    let offset = haystack.indexOf(lowered)
    if (offset < 0) continue
    const fragment = window.document.createDocumentFragment()
    let cursor = 0
    while (offset >= 0 && marks.length < MAX_HIGHLIGHTS) {
      if (offset > cursor) fragment.appendChild(window.document.createTextNode(value.slice(cursor, offset)))
      const mark = window.document.createElement('mark')
      mark.dataset.ezreaderHit = 'true'
      mark.className = 'search-hit'
      mark.textContent = value.slice(offset, offset + term.length)
      fragment.appendChild(mark)
      marks.push(mark)
      cursor = offset + term.length
      offset = haystack.indexOf(lowered, cursor)
    }
    if (cursor < value.length) fragment.appendChild(window.document.createTextNode(value.slice(cursor)))
    textNode.parentNode?.replaceChild(fragment, textNode)
  }
  return marks
}

function textContentOf(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return parsed.body.textContent ?? ''
}

export function TextReader({ doc, file, initialLocation, onClose }: ReaderProps) {
  const { t } = useI18n()
  const readerSettings = useAppSelector((state) => state.settings.reader)
  const report = useReaderProgress(doc)
  const [html, setHtml] = useState('')
  const [plain, setPlain] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [location, setLocation] = useState<ReaderLocation | null>(null)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TextSearchResult[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const initialRatioRef = useRef(
    initialLocation && initialLocation.type === 'scroll'
      ? clamp(Number(initialLocation.value) || 0)
      : 0,
  )
  const restoredRef = useRef(false)
  const latestRef = useRef<{ location: ReaderLocation; total: number } | null>(null)
  const activeResultRef = useRef(0)
  const translateRef = useRef(t)
  translateRef.current = t

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setHtml('')
    setPlain('')
    setResults([])
    setSearched(false)
    setAppliedQuery('')
    restoredRef.current = false

    const load = async () => {
      try {
        let content = ''
        if (doc.format === 'txt') {
          content = escapeHtml(await file.text())
        } else if (doc.format === 'rtf') {
          content = escapeHtml(rtfToText(await file.text()))
        } else if (doc.format === 'docx') {
          const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
          content = DOMPurify.sanitize(result.value, {
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
          })
        } else {
          throw new Error('This text format is not supported.')
        }
        if (cancelled) return
        const raw = textContentOf(content)
        setHtml(content)
        setPlain(raw)
        setLoading(false)
      } catch (issue) {
        if (!cancelled) {
          setError(errorMessage(issue, translateRef.current('reader.errorText')))
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [attempt, doc.format, file])

  const measure = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const max = container.scrollHeight - container.clientHeight
    const ratio = max <= 2 ? 1 : clamp(container.scrollTop / max)
    const total = Math.max(1, Math.ceil(container.scrollHeight / Math.max(1, container.clientHeight)))
    const page = max <= 2 ? total : clamp(Math.floor(container.scrollTop / Math.max(1, container.clientHeight)) + 1, 1, total)
    const next = readerLocation(
      'scroll',
      ratio,
      ratio,
      translateRef.current('reader.pageOf', { page, total }),
      page,
    )
    latestRef.current = { location: next, total }
    setLocation((previous) => {
      if (
        previous &&
        previous.page === next.page &&
        Math.round(previous.percentage * 1000) === Math.round(next.percentage * 1000)
      ) {
        return previous
      }
      return next
    })
    report(next, total)
  }, [report])

  useEffect(() => {
    if (loading || !html) return
    const container = scrollRef.current
    if (!container) return
    const frame = window.requestAnimationFrame(() => {
      if (!restoredRef.current) {
        restoredRef.current = true
        const max = container.scrollHeight - container.clientHeight
        container.scrollTop = initialRatioRef.current * Math.max(0, max)
      }
      measure()
    })
    const timer = window.setTimeout(() => {
      if (!restoredRef.current) return
      const max = container.scrollHeight - container.clientHeight
      if (initialRatioRef.current > 0 && max > 0 && Math.abs(container.scrollTop - initialRatioRef.current * max) > 40) {
        container.scrollTop = initialRatioRef.current * max
      }
      measure()
    }, 220)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [html, loading, measure])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [measure])

  const scrollToRatio = useCallback((ratio: number) => {
    const container = scrollRef.current
    if (!container) return
    const max = Math.max(0, container.scrollHeight - container.clientHeight)
    container.scrollTo({ top: clamp(ratio) * max, behavior: 'smooth' })
  }, [])

  const goToLocation = useCallback(
    (target: ReaderLocation) => {
      if (target.type === 'scroll') scrollToRatio(Number(target.value) || 0)
      else scrollToRatio(target.percentage)
    },
    [scrollToRatio],
  )

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const container = scrollRef.current
    if (!container) return
    container.scrollBy({ top: direction * container.clientHeight * 0.9, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'PageDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        scrollByPage(1)
      } else if (event.key === 'PageUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollByPage(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scrollByPage])

  useEffect(() => {
    const container = contentRef.current
    if (!container || !html) return
    removeHighlights(container)
    if (!appliedQuery || !searched) return
    const marks = applyHighlights(container, appliedQuery)
    const active = marks[activeResultRef.current]
    if (active) {
      active.classList.add('active')
      active.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
  }, [appliedQuery, html, searched])

  const runSearch = () => {
    const term = query.trim()
    if (!term) return
    setSearching(true)
    setSearched(true)
    const lowered = term.toLocaleLowerCase()
    const haystack = plain.toLocaleLowerCase()
    const found: TextSearchResult[] = []
    let offset = haystack.indexOf(lowered)
    while (offset >= 0 && found.length < MAX_SEARCH_RESULTS) {
      found.push({ offset, snippet: snippetAround(plain, offset, term.length) })
      offset = haystack.indexOf(lowered, offset + Math.max(1, lowered.length))
    }
    activeResultRef.current = 0
    setResults(found)
    setAppliedQuery(term)
    setSearching(false)
  }

  const jumpToResult = (index: number) => {
    activeResultRef.current = index
    const container = contentRef.current
    if (!container) return
    const marks = container.querySelectorAll<HTMLElement>('mark[data-ezreader-hit]')
    marks.forEach((mark) => mark.classList.remove('active'))
    const mark = marks[index]
    if (mark) {
      mark.classList.add('active')
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  const palette = BACKGROUNDS[readerSettings.background]
  const settingsPanel = <ReaderAppearancePanel variant="text" />
  const progress = location?.percentage ?? 0

  const searchPanel = (
    <div className="reader-search">
      <form
        className="reader-search-form"
        onSubmit={(event) => {
          event.preventDefault()
          runSearch()
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
        <button type="submit" className="button button-primary button-small" disabled={!query.trim() || loading}>
          {searching ? <LoaderCircle size={15} className="spin" /> : t('common.search')}
        </button>
      </form>
      {!searched && <div className="reader-panel-empty">{t('reader.searchHint')}</div>}
      {searched && results.length === 0 && <div className="reader-panel-empty">{t('reader.searchEmpty')}</div>}
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
                key={`${result.offset}-${index}`}
                className="reader-search-result"
                onClick={() => jumpToResult(index)}
              >
                <span>{index + 1}</span>
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
      location={location}
      progress={progress}
      onNavigate={goToLocation}
      onClose={onClose}
      settings={settingsPanel}
      search={searchPanel}
      controls={
        <>
          <button
            type="button"
            className="reader-nav-button"
            onClick={() => scrollByPage(-1)}
            title={t('reader.previous')}
          >
            <ChevronUp size={20} />
          </button>
          <button
            type="button"
            className="reader-nav-button"
            onClick={() => scrollByPage(1)}
            title={t('reader.next')}
          >
            <ChevronDown size={20} />
          </button>
          <span className="reader-location-label">{location?.label ?? t('reader.loadingDocument')}</span>
          <span className="reader-percent-label">{Math.round(progress * 100)}%</span>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => scrollToRatio(0)}
            disabled={progress <= 0.001}
          >
            {t('common.back')}
          </button>
        </>
      }
    >
      <div
        className="text-reader"
        style={
          {
            '--reader-bg': palette.background,
            '--reader-text': palette.text,
            '--reader-muted': palette.muted,
            '--reader-accent': palette.accent,
            '--reader-font-size': `${readerSettings.fontSize}px`,
            '--reader-line-height': String(readerSettings.lineHeight),
            '--reader-margin': `${readerSettings.margin}px`,
            '--reader-font': FONT_STACKS[readerSettings.fontFamily],
          } as CSSProperties
        }
      >
        <div className="text-scroll" ref={scrollRef}>
          {loading ? (
            <div className="reader-loading-overlay">
              <LoaderCircle size={28} className="spin" />
              <span>{t('reader.loadingDocument')}</span>
            </div>
          ) : (
            <article
              className={`text-doc format-${doc.format}`}
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </ReaderShell>
  )
}
