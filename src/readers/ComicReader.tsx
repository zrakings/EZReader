import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react'
import { useAppSelector, useI18n } from '../hooks/useAppStore'
import {
  openComicArchive,
  openImageSource,
  type PageSource,
} from '../services/archiveHandler/archive'
import type { ReaderLocation } from '../types'
import { clamp, errorMessage, isEditableElement, readerLocation } from '../utils/format'
import { ReaderAppearancePanel } from './ReaderAppearancePanel'
import { ReaderShell } from './ReaderShell'
import type { ReaderProps } from './types'
import { useReaderProgress } from './useReaderProgress'

function startIndexFor(initialLocation: ReaderLocation | null, count: number): number {
  if (!initialLocation) return 0
  const raw =
    typeof initialLocation.page === 'number'
      ? initialLocation.page - 1
      : Number.parseInt(initialLocation.value, 10) || 0
  return Math.max(0, Math.min(count - 1, Math.round(raw)))
}

function ComicImage({
  source,
  index,
  eager,
  scrollRoot,
  alt,
}: {
  source: PageSource
  index: number
  eager: boolean
  scrollRoot: RefObject<HTMLDivElement | null>
  alt: string
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(eager)
  const holderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (eager) {
      setVisible(true)
      return
    }
    const element = holderRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { root: scrollRoot.current, rootMargin: '1200px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [eager, scrollRoot])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setFailed(false)
    source
      .getObjectURL(index)
      .then((next) => {
        if (!cancelled) setUrl(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [index, source, visible])

  if (failed) {
    return (
      <div className="comic-failed" ref={holderRef}>
        <ImageOff size={28} />
        <span>{t('reader.errorTitle')}</span>
      </div>
    )
  }

  return (
    <div className={`comic-image-holder ${url ? 'is-loaded' : ''}`} ref={holderRef}>
      {!url && (
        <div className="comic-image-loading">
          <LoaderCircle size={24} className="spin" />
        </div>
      )}
      {url && <img src={url} alt={alt} draggable={false} />}
    </div>
  )
}

export function ComicReader({ doc, file, initialLocation, onClose }: ReaderProps) {
  const { t } = useI18n()
  const readerSettings = useAppSelector((state) => state.settings.reader)
  const report = useReaderProgress(doc)
  const [source, setSource] = useState<PageSource | null>(null)
  const [count, setCount] = useState(0)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pageInput, setPageInput] = useState('1')
  const scrollRef = useRef<HTMLDivElement>(null)
  const startIndexRef = useRef(0)
  const indexRef = useRef(0)
  const direction = readerSettings.readingDirection
  const layout = count <= 1 ? 'single' : readerSettings.comicLayout
  const step = layout === 'double' ? 2 : 1

  useEffect(() => {
    let cancelled = false
    let opened: PageSource | null = null
    setLoading(true)
    setError('')
    setSource(null)
    setCount(0)

    const open = async () => {
      try {
        const next =
          doc.format === 'image' ? await openImageSource(file) : await openComicArchive(file, doc.format)
        if (cancelled) {
          next.dispose()
          return
        }
        opened = next
        const start = startIndexFor(initialLocation, next.count)
        startIndexRef.current = start
        indexRef.current = start
        setIndex(start)
        setPageInput(String(start + 1))
        setCount(next.count)
        setSource(next)
        setLoading(false)
      } catch (issue) {
        if (!cancelled) {
          setError(errorMessage(issue, t('reader.errorText')))
          setLoading(false)
        }
      }
    }

    void open()
    return () => {
      cancelled = true
      opened?.dispose()
    }
    // The initial location only matters when opening the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, doc.format, file])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (!source || layout === 'vertical') return
    let cancelled = false
    const wanted: number[] = [index]
    if (layout === 'double' && index + 1 < source.count) wanted.push(index + 1)
    for (let offset = 1; offset <= 2; offset += 1) {
      if (index + offset < source.count) wanted.push(index + offset)
    }
    const load = async () => {
      for (const pageIndex of Array.from(new Set(wanted))) {
        if (cancelled) return
        try {
          const url = await source.getObjectURL(pageIndex)
          if (cancelled) return
          const image = new Image()
          image.src = url
        } catch {
          // A single damaged page should not break the whole archive.
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [index, layout, source])

  const location = readerLocation(
    doc.format === 'image' ? 'image' : 'comic-page',
    index,
    count ? (index + 1) / count : 0,
    count
      ? t('reader.pageOf', { page: Math.min(index + 1, count), total: count })
      : t('reader.loadingDocument'),
    index + 1,
  )

  useEffect(() => {
    if (!count) return
    report(location, count, true)
    setPageInput(String(index + 1))
    // location is intentionally derived from index/count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, index])

  const jumpToPage = useCallback(
    (target: number) => {
      if (!count) return
      const next = clamp(Math.round(target), 1, count) - 1
      indexRef.current = next
      setIndex(next)
      if (layout === 'vertical') {
        const element = scrollRef.current?.querySelector<HTMLElement>(
          `[data-page-index="${next}"]`,
        )
        element?.scrollIntoView({ block: 'start' })
      }
    },
    [count, layout],
  )

  const previous = useCallback(() => {
    setIndex((current) => {
      const next = Math.max(0, current - step)
      indexRef.current = next
      return next
    })
  }, [step])

  const next = useCallback(() => {
    setIndex((current) => {
      const next = Math.min(count - 1, current + step)
      indexRef.current = next
      return next
    })
  }, [count, step])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === backward || event.key === 'PageUp') {
        event.preventDefault()
        previous()
      } else if (event.key === forward || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [direction, next, previous])

  useEffect(() => {
    if (!source || layout !== 'vertical') return
    const container = scrollRef.current
    if (!container) return
    let frame = 0
    const update = () => {
      frame = 0
      const marker = container.clientHeight * 0.45
      const pages = container.querySelectorAll<HTMLElement>('[data-page-index]')
      let active = indexRef.current
      for (const page of Array.from(pages)) {
        const rect = page.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        if (rect.top - containerRect.top <= marker) {
          active = Number(page.dataset.pageIndex) || 0
        } else {
          break
        }
      }
      if (active !== indexRef.current) {
        indexRef.current = active
        setIndex(active)
      }
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [layout, source])

  useEffect(() => {
    if (!source || layout !== 'vertical') return
    const container = scrollRef.current
    if (!container) return
    const timer = window.setTimeout(() => {
      const element = container.querySelector<HTMLElement>(
        `[data-page-index="${startIndexRef.current}"]`,
      )
      element?.scrollIntoView({ block: 'start' })
    }, 90)
    return () => window.clearTimeout(timer)
  }, [layout, source])

  if (error) {
    return (
      <div className="reader-root reader-gate-root">
        <div className="reader-gate">
          <div className="reader-gate-icon">
            <ImageOff size={32} />
          </div>
          <h1>{t('reader.errorTitle')}</h1>
          <p>{error}</p>
          <p className="reader-gate-hint">{t('reader.errorText')}</p>
          <div className="reader-gate-actions">
            <button type="button" className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>
              <RotateCcw size={16} />
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

  const spreadIndexes =
    layout === 'double' && index + 1 < count ? [index, index + 1] : [index]

  return (
    <ReaderShell
      doc={doc}
      location={count ? location : null}
      progress={count ? (index + 1) / count : 0}
      onNavigate={(target) => {
        if (target.page) jumpToPage(target.page)
        else jumpToPage(Number(target.value) + 1)
      }}
      onClose={onClose}
      settings={<ReaderAppearancePanel variant="comic" />}
      controls={
        <>
          <button
            type="button"
            className="reader-nav-button"
            onClick={previous}
            disabled={index <= 0}
            title={t('reader.previous')}
          >
            <ChevronLeft size={20} />
          </button>
          <form
            className="reader-page-form"
            onSubmit={(event) => {
              event.preventDefault()
              jumpToPage(Number(pageInput))
            }}
          >
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => jumpToPage(Number(pageInput))}
              inputMode="numeric"
              aria-label={t('reader.page', { page: index + 1 })}
            />
            <span>/ {count || '—'}</span>
          </form>
          <button
            type="button"
            className="reader-nav-button"
            onClick={next}
            disabled={index >= count - 1}
            title={t('reader.next')}
          >
            <ChevronRight size={20} />
          </button>
          <input
            className="reader-progress-range"
            type="range"
            min={1}
            max={Math.max(1, count)}
            value={Math.min(count || 1, index + 1)}
            disabled={count <= 1}
            onChange={(event) => jumpToPage(Number(event.target.value))}
            aria-label={t('reader.progress')}
          />
          <span className="reader-percent-label">
            {count ? Math.round(((index + 1) / count) * 100) : 0}%
          </span>
          <span className="reader-layout-label">
            {layout === 'double'
              ? t('reader.doublePage')
              : layout === 'vertical'
                ? t('reader.vertical')
                : t('reader.singlePage')}
            {count > 1 ? ` · ${direction.toUpperCase()}` : ''}
          </span>
        </>
      }
    >
      <div className="comic-reader">
        {layout === 'vertical' ? (
          <div className="comic-vertical" ref={scrollRef}>
            {source &&
              Array.from({ length: count }, (_, pageIndex) => (
                <div className="comic-vertical-page" key={pageIndex} data-page-index={pageIndex}>
                  <ComicImage
                    source={source}
                    index={pageIndex}
                    eager={pageIndex < 2}
                    scrollRoot={scrollRef}
                    alt={t('reader.page', { page: pageIndex + 1 })}
                  />
                </div>
              ))}
            {loading && (
              <div className="reader-loading-overlay">
                <LoaderCircle size={28} className="spin" />
                <span>{t('reader.loadingDocument')}</span>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`comic-spread layout-${layout}`}
            dir={direction === 'rtl' ? 'rtl' : 'ltr'}
          >
            {source ? (
              spreadIndexes.map((pageIndex) => (
                <div className="comic-single-page" key={pageIndex}>
                  <ComicImage
                    source={source}
                    index={pageIndex}
                    eager
                    scrollRoot={scrollRef}
                    alt={t('reader.page', { page: pageIndex + 1 })}
                  />
                </div>
              ))
            ) : (
              <div className="reader-loading-overlay">
                <LoaderCircle size={28} className="spin" />
                <span>{t('reader.loadingDocument')}</span>
              </div>
            )}
          </div>
        )}
        {layout !== 'vertical' && (
          <>
            <button
              type="button"
              className="comic-edge previous"
              onClick={direction === 'rtl' ? next : previous}
              disabled={index <= 0}
              aria-label={t('reader.previous')}
            >
              <ChevronLeft size={26} />
            </button>
            <button
              type="button"
              className="comic-edge next"
              onClick={direction === 'rtl' ? previous : next}
              disabled={index >= count - 1}
              aria-label={t('reader.next')}
            >
              <ChevronRight size={26} />
            </button>
          </>
        )}
        {loading && layout !== 'vertical' && (
          <div className="reader-loading-overlay">
            <LoaderCircle size={28} className="spin" />
            <span>{t('reader.loadingDocument')}</span>
          </div>
        )}
        {!loading && !count && (
          <div className="reader-panel-empty">{t('import.noImages')}</div>
        )}
      </div>
    </ReaderShell>
  )
}
