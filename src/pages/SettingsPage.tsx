import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Info,
  Languages,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import { fileRegistry, store } from '../services/storage/store'
import {
  applyBackup,
  buildBackup,
  countBackup,
  downloadBackup,
  parseBackup,
  type ImportSummary,
} from '../services/backup'
import type { AccentColor, BackupEnvelope, BackupKind, FontFamily, GridSize, ReaderBackground, ComicLayout, ReadingDirection, SortKey, ThemeMode, ViewMode, PdfZoomPreset } from '../types'
import { SORT_OPTIONS } from '../utils/sort'
import { Modal } from '../components/common/Modal'
import { PageHeader } from '../components/common/UI'
import { useUI } from '../components/common/UIProvider'

const ACCENTS: Array<{ value: AccentColor; label: string }> = [
  { value: 'mint', label: 'Mint' },
  { value: 'violet', label: 'Violet' },
  { value: 'sky', label: 'Sky' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
]

export function SettingsPage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const { toast, confirm } = useUI()
  const importInput = useRef<HTMLInputElement>(null)
  const [review, setReview] = useState<{ envelope: BackupEnvelope; counts: ReturnType<typeof countBackup> } | null>(null)
  const [applying, setApplying] = useState(false)
  const settings = state.settings
  const reader = settings.reader

  const exportBackup = (kind: BackupKind) => {
    const empty =
      (kind === 'full' &&
        !state.documents.length &&
        !state.collections.length &&
        !state.series.length &&
        !state.bookmarks.length &&
        !state.notes.length &&
        !state.history.length) ||
      (kind === 'collections' && !state.collections.length) ||
      (kind === 'series' && !state.series.length) ||
      (kind === 'bookmarks' && !state.bookmarks.length) ||
      (kind === 'notes' && !state.notes.length) ||
      (kind === 'history' && !state.history.length) ||
      (kind === 'favorites' && !state.documents.some((doc) => doc.favorite))
    if (empty) {
      toast(t('settings.noData'), 'info')
      return
    }
    downloadBackup(buildBackup(kind, state))
    toast(t('settings.exportSuccess'), 'success')
  }

  const readBackup = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 30 * 1024 * 1024) {
      toast(t('settings.importTooLarge'), 'error')
      return
    }
    try {
      const text = await file.text()
      const envelope = parseBackup(text)
      setReview({ envelope, counts: countBackup(envelope) })
    } catch (error) {
      toast(`${t('settings.importInvalid')} ${error instanceof Error ? error.message : ''}`, 'error')
    }
  }

  const apply = async (mode: 'merge' | 'replace') => {
    if (!review) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: t('settings.replace'),
        description: t('settings.replaceWarning'),
        confirmLabel: t('settings.replace'),
        danger: true,
      })
      if (!ok) return
    }
    setApplying(true)
    try {
      const result = applyBackup(review.envelope, mode, store.getState())
      if (mode === 'replace') fileRegistry.clear()
      store.replaceState(result.state)
      const summary: ImportSummary = result.summary
      toast(
        `${t('settings.importSuccess')} · ${summary.documents + summary.collections + summary.series + summary.bookmarks + summary.notes + summary.history}`,
        'success',
      )
      setReview(null)
    } catch (error) {
      toast(`${t('settings.importInvalid')} ${error instanceof Error ? error.message : ''}`, 'error')
    } finally {
      setApplying(false)
    }
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: t('settings.clearAllTitle'),
      description: t('settings.clearAllText'),
      confirmLabel: t('settings.clearAll'),
      danger: true,
    })
    if (!ok) return
    fileRegistry.clear()
    store.clearAllData()
    toast(t('toast.storageCleared'), 'success')
  }

  const resetSettings = async () => {
    const ok = await confirm({
      title: t('settings.resetTitle'),
      description: t('settings.resetText'),
      confirmLabel: t('settings.resetSettings'),
      danger: true,
    })
    if (!ok) return
    store.resetSettings()
    toast(t('toast.settingsReset'), 'success')
  }

  const clearHistory = async () => {
    const ok = await confirm({
      title: t('settings.clearHistoryTitle'),
      description: t('history.clearConfirmText'),
      confirmLabel: t('settings.clearHistory'),
      danger: true,
    })
    if (!ok) return
    store.clearHistory()
    toast(t('toast.historyCleared'), 'success')
  }

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow={t('nav.system')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <section className="settings-section">
        <div className="settings-section-head">
          <Palette size={18} />
          <div>
            <h2>{t('settings.general')}</h2>
            <p>{t('settings.appearance')}</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <strong>{t('settings.theme')}</strong>
                <small>{t('settings.themeSystem')} · {t('settings.themeDark')} · {t('settings.themeLight')}</small>
              </div>
              <div className="segmented">
                <button
                  type="button"
                  className={settings.theme === 'dark' ? 'active' : ''}
                  onClick={() => store.updateSettings({ theme: 'dark' })}
                >
                  <Moon size={14} />
                  {t('settings.themeDark')}
                </button>
                <button
                  type="button"
                  className={settings.theme === 'light' ? 'active' : ''}
                  onClick={() => store.updateSettings({ theme: 'light' })}
                >
                  <Sun size={14} />
                  {t('settings.themeLight')}
                </button>
                <button
                  type="button"
                  className={settings.theme === 'system' ? 'active' : ''}
                  onClick={() => store.updateSettings({ theme: 'system' })}
                >
                  <Monitor size={14} />
                  {t('settings.themeSystem')}
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.language')}</strong>
                <small>{t('settings.english')} · {t('settings.indonesian')}</small>
              </div>
              <label className="inline-select">
                <Languages size={15} />
                <select
                  value={settings.language}
                  onChange={(event) => store.updateSettings({ language: event.target.value as 'en' | 'id' })}
                >
                  <option value="en">{t('settings.english')}</option>
                  <option value="id">{t('settings.indonesian')}</option>
                </select>
              </label>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.accent')}</strong>
                <small>Mint, violet, sky, amber, rose</small>
              </div>
              <div className="accent-swatches">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.value}
                    type="button"
                    className={`accent-swatch accent-${accent.value} ${settings.accent === accent.value ? 'active' : ''}`}
                    aria-label={accent.label}
                    title={accent.label}
                    onClick={() => store.updateSettings({ accent: accent.value })}
                  />
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.gridSize')}</strong>
                <small>{t('settings.gridCompact')} · {t('settings.gridComfortable')} · {t('settings.gridLarge')}</small>
              </div>
              <select
                value={settings.gridSize}
                onChange={(event) => store.updateSettings({ gridSize: event.target.value as GridSize })}
              >
                <option value="compact">{t('settings.gridCompact')}</option>
                <option value="comfortable">{t('settings.gridComfortable')}</option>
                <option value="large">{t('settings.gridLarge')}</option>
              </select>
            </div>
          </div>

          <div className="settings-card">
            <div className="setting-row">
              <div>
                <strong>{t('settings.defaultView')}</strong>
                <small>{t('library.grid')} · {t('library.list')}</small>
              </div>
              <select
                value={settings.defaultView}
                onChange={(event) => store.updateSettings({ defaultView: event.target.value as ViewMode })}
              >
                <option value="grid">{t('library.grid')}</option>
                <option value="list">{t('library.list')}</option>
              </select>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.defaultSort')}</strong>
                <small>{t('library.sortBy')}</small>
              </div>
              <select
                value={settings.defaultSort}
                onChange={(event) => store.updateSettings({ defaultSort: event.target.value as SortKey })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-note">
              <Info size={16} />
              <p>{t('settings.storageNote')}</p>
            </div>
            <div className="settings-note">
              <AlertTriangle size={16} />
              <p>{t('settings.sessionNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <Monitor size={18} />
          <div>
            <h2>{t('settings.reading')}</h2>
            <p>{t('reader.settings')}</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <strong>{t('settings.fontFamily')}</strong>
                <small>{t('settings.fontSerif')} · {t('settings.fontSans')} · {t('settings.fontMono')}</small>
              </div>
              <select
                value={reader.fontFamily}
                onChange={(event) => store.updateReaderSettings({ fontFamily: event.target.value as FontFamily })}
              >
                <option value="serif">{t('settings.fontSerif')}</option>
                <option value="sans">{t('settings.fontSans')}</option>
                <option value="mono">{t('settings.fontMono')}</option>
              </select>
            </div>

            <label className="setting-row slider-row">
              <div>
                <strong>{t('settings.fontSize')}</strong>
                <small>{reader.fontSize}px</small>
              </div>
              <input
                type="range"
                min={10}
                max={32}
                step={1}
                value={reader.fontSize}
                onChange={(event) => store.updateReaderSettings({ fontSize: Number(event.target.value) })}
              />
            </label>

            <label className="setting-row slider-row">
              <div>
                <strong>{t('settings.lineHeight')}</strong>
                <small>{reader.lineHeight.toFixed(1)}</small>
              </div>
              <input
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={reader.lineHeight}
                onChange={(event) => store.updateReaderSettings({ lineHeight: Number(event.target.value) })}
              />
            </label>

            <label className="setting-row slider-row">
              <div>
                <strong>{t('settings.margin')}</strong>
                <small>{reader.margin}px</small>
              </div>
              <input
                type="range"
                min={8}
                max={140}
                step={4}
                value={reader.margin}
                onChange={(event) => store.updateReaderSettings({ margin: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="settings-card">
            <div className="setting-row">
              <div>
                <strong>{t('settings.background')}</strong>
                <small>{t('reader.dark')} · {t('reader.black')} · {t('reader.sepia')} · {t('reader.light')}</small>
              </div>
              <select
                value={reader.background}
                onChange={(event) => store.updateReaderSettings({ background: event.target.value as ReaderBackground })}
              >
                <option value="dark">{t('reader.dark')}</option>
                <option value="black">{t('reader.black')}</option>
                <option value="sepia">{t('reader.sepia')}</option>
                <option value="light">{t('reader.light')}</option>
              </select>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.pdfZoom')}</strong>
                <small>{t('reader.fitWidth')} · {t('reader.fitPage')} · {t('reader.actualSize')}</small>
              </div>
              <select
                value={reader.pdfZoomPreset}
                onChange={(event) => store.updateReaderSettings({ pdfZoomPreset: event.target.value as PdfZoomPreset })}
              >
                <option value="fit-width">{t('reader.fitWidth')}</option>
                <option value="fit-page">{t('reader.fitPage')}</option>
                <option value="actual">{t('reader.actualSize')}</option>
              </select>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.comicLayout')}</strong>
                <small>{t('reader.single')} · {t('reader.double')} · {t('reader.vertical')}</small>
              </div>
              <select
                value={reader.comicLayout}
                onChange={(event) => store.updateReaderSettings({ comicLayout: event.target.value as ComicLayout })}
              >
                <option value="single">{t('reader.single')}</option>
                <option value="double">{t('reader.double')}</option>
                <option value="vertical">{t('reader.vertical')}</option>
              </select>
            </div>

            <div className="setting-row">
              <div>
                <strong>{t('settings.direction')}</strong>
                <small>{t('reader.ltr')} · {t('reader.rtl')}</small>
              </div>
              <select
                value={reader.readingDirection}
                onChange={(event) => store.updateReaderSettings({ readingDirection: event.target.value as ReadingDirection })}
              >
                <option value="ltr">{t('reader.ltr')}</option>
                <option value="rtl">{t('reader.rtl')}</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <Database size={18} />
          <div>
            <h2>{t('settings.data')}</h2>
            <p>{t('settings.backupTitle')}</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-card">
            <h3>{t('settings.exportMetadata')}</h3>
            <p className="settings-card-text">{t('settings.exportMetadataHelp')}</p>
            <div className="data-actions">
              <button type="button" className="button button-primary" onClick={() => exportBackup('full')}>
                <Download size={15} />
                {t('settings.exportMetadata')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('collections')}>
                <Download size={14} />
                {t('settings.exportCollections')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('series')}>
                <Download size={14} />
                {t('settings.exportSeries')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('bookmarks')}>
                <Download size={14} />
                {t('settings.exportBookmarks')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('notes')}>
                <Download size={14} />
                {t('settings.exportNotes')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('history')}>
                <Download size={14} />
                {t('settings.exportHistory')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => exportBackup('favorites')}>
                <Download size={14} />
                {t('favorites.title')}
              </button>
            </div>
            <div className="settings-note">
              <CheckCircle2 size={16} />
              <p>{t('settings.backupExported')}</p>
            </div>
          </div>

          <div className="settings-card">
            <h3>{t('settings.importMetadata')}</h3>
            <p className="settings-card-text">{t('settings.backupHelp')}</p>
            <div className="data-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => importInput.current?.click()}
              >
                <Upload size={15} />
                {t('settings.importMetadata')}
              </button>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  void readBackup(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>
            <div className="settings-note">
              <Database size={16} />
              <p>{t('settings.storageNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section danger-zone">
        <div className="settings-section-head">
          <AlertTriangle size={18} />
          <div>
            <h2>{t('settings.clearAll')}</h2>
            <p>{t('settings.clearAllText')}</p>
          </div>
        </div>
        <div className="danger-actions">
          <button type="button" className="button button-ghost" onClick={() => void clearHistory()}>
            <Trash2 size={15} />
            {t('settings.clearHistory')}
          </button>
          <button type="button" className="button button-ghost" onClick={() => void resetSettings()}>
            <RotateCcw size={15} />
            {t('settings.resetSettings')}
          </button>
          <button type="button" className="button button-danger" onClick={() => void clearAll()}>
            <Trash2 size={15} />
            {t('settings.clearAll')}
          </button>
        </div>
      </section>

      <section className="settings-section about-section">
        <div className="settings-section-head">
          <Info size={18} />
          <div>
            <h2>{t('settings.about')}</h2>
            <p>{t('settings.aboutText')}</p>
          </div>
        </div>
        <div className="about-meta">
          <span>{t('settings.appVersion')}</span>
          <span>{t('app.localOnly')}</span>
          <span>{t('app.tagline')}</span>
        </div>
      </section>

      {review && (
        <Modal
          title={t('settings.importReview')}
          onClose={() => setReview(null)}
          closeLabel={t('common.close')}
          footer={
            <>
              <button type="button" className="button button-ghost" onClick={() => setReview(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={applying}
                onClick={() => void apply('merge')}
              >
                {t('settings.merge')}
              </button>
              {review.envelope.kind === 'full' && (
                <button
                  type="button"
                  className="button button-danger"
                  disabled={applying}
                  onClick={() => void apply('replace')}
                >
                  {t('settings.replace')}
                </button>
              )}
            </>
          }
        >
          <p className="backup-review-lead">{t('settings.importReviewText')}</p>
          <div className="backup-review-grid">
            <div><span>{t('statistics.totalDocuments')}</span><strong>{review.counts.documents}</strong></div>
            <div><span>{t('nav.collections')}</span><strong>{review.counts.collections}</strong></div>
            <div><span>{t('nav.series')}</span><strong>{review.counts.series}</strong></div>
            <div><span>{t('bookmarks.title')}</span><strong>{review.counts.bookmarks}</strong></div>
            <div><span>{t('notes.title')}</span><strong>{review.counts.notes}</strong></div>
            <div><span>{t('history.title')}</span><strong>{review.counts.history}</strong></div>
            <div><span>{t('favorites.title')}</span><strong>{review.counts.favorites}</strong></div>
            <div><span>{t('settings.backupTitle')}</span><strong>{review.envelope.kind}</strong></div>
          </div>
          <p className="muted-note">{review.envelope.note}</p>
          <div className="settings-note">
            <AlertTriangle size={16} />
            <p>{t('settings.replaceWarning')}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
