import type { ReactNode } from 'react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { store } from '../services/storage/store'
import type { ComicLayout, FontFamily, ReaderBackground, ReadingDirection } from '../types'

interface ReaderAppearancePanelProps {
  variant: 'text' | 'pdf' | 'comic'
  extra?: ReactNode
}

export function ReaderAppearancePanel({ variant, extra }: ReaderAppearancePanelProps) {
  const { t } = useI18n()
  const settings = useAppState().settings
  const reader = settings.reader

  return (
    <div className="reader-settings">
      {variant === 'text' && (
        <>
          <label className="reader-field">
            <span>{t('reader.fontSize')}</span>
            <div className="reader-slider-row">
              <input
                type="range"
                min={10}
                max={32}
                step={1}
                value={reader.fontSize}
                onChange={(event) => store.updateReaderSettings({ fontSize: Number(event.target.value) })}
              />
              <em>{reader.fontSize}px</em>
            </div>
          </label>
          <label className="reader-field">
            <span>{t('reader.lineHeight')}</span>
            <div className="reader-slider-row">
              <input
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={reader.lineHeight}
                onChange={(event) => store.updateReaderSettings({ lineHeight: Number(event.target.value) })}
              />
              <em>{reader.lineHeight.toFixed(1)}</em>
            </div>
          </label>
          <label className="reader-field">
            <span>{t('reader.margins')}</span>
            <div className="reader-slider-row">
              <input
                type="range"
                min={8}
                max={140}
                step={4}
                value={reader.margin}
                onChange={(event) => store.updateReaderSettings({ margin: Number(event.target.value) })}
              />
              <em>{reader.margin}px</em>
            </div>
          </label>
          <label className="reader-field">
            <span>{t('settings.fontFamily')}</span>
            <select
              value={reader.fontFamily}
              onChange={(event) => store.updateReaderSettings({ fontFamily: event.target.value as FontFamily })}
            >
              <option value="serif">{t('settings.fontSerif')}</option>
              <option value="sans">{t('settings.fontSans')}</option>
              <option value="mono">{t('settings.fontMono')}</option>
            </select>
          </label>
          <label className="reader-field">
            <span>{t('reader.background')}</span>
            <select
              value={reader.background}
              onChange={(event) => store.updateReaderSettings({ background: event.target.value as ReaderBackground })}
            >
              <option value="dark">{t('reader.dark')}</option>
              <option value="black">{t('reader.black')}</option>
              <option value="sepia">{t('reader.sepia')}</option>
              <option value="light">{t('reader.light')}</option>
            </select>
          </label>
        </>
      )}

      {variant === 'pdf' && (
        <>
          <label className="reader-field">
            <span>{t('settings.pdfZoom')}</span>
            <select
              value={reader.pdfZoomPreset}
              onChange={(event) =>
                store.updateReaderSettings({
                  pdfZoomPreset: event.target.value as typeof reader.pdfZoomPreset,
                })
              }
            >
              <option value="fit-width">{t('reader.fitWidth')}</option>
              <option value="fit-page">{t('reader.fitPage')}</option>
              <option value="actual">{t('reader.actualSize')}</option>
            </select>
          </label>
          <p className="reader-hint">{t('reader.keyboardHint')}</p>
        </>
      )}

      {variant === 'comic' && (
        <>
          <label className="reader-field">
            <span>{t('reader.pageLayout')}</span>
            <div className="segmented">
              {(['single', 'double', 'vertical'] as ComicLayout[]).map((layout) => (
                <button
                  type="button"
                  key={layout}
                  className={reader.comicLayout === layout ? 'active' : ''}
                  onClick={() => store.updateReaderSettings({ comicLayout: layout })}
                >
                  {layout === 'single' ? t('reader.single') : layout === 'double' ? t('reader.double') : t('reader.vertical')}
                </button>
              ))}
            </div>
          </label>
          <label className="reader-field">
            <span>{t('reader.turnDirection')}</span>
            <div className="segmented">
              {(['ltr', 'rtl'] as ReadingDirection[]).map((direction) => (
                <button
                  type="button"
                  key={direction}
                  className={reader.readingDirection === direction ? 'active' : ''}
                  onClick={() => store.updateReaderSettings({ readingDirection: direction })}
                >
                  {direction === 'ltr' ? t('reader.ltr') : t('reader.rtl')}
                </button>
              ))}
            </div>
          </label>
        </>
      )}

      {extra}
    </div>
  )
}
