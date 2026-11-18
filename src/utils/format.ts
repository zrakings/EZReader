import type {
  DocumentCategory,
  DocumentFormat,
  DocumentMeta,
  ReadingStatus,
  ReaderLocation,
} from '../types'

export const MAX_COVER_WIDTH = 360
export const MAX_COVER_HEIGHT = 500

export const ACCEPTED_EXTENSIONS = [
  'pdf',
  'epub',
  'cbz',
  'cbr',
  'cb7',
  'cbt',
  'zip',
  'txt',
  'docx',
  'rtf',
  'jpg',
  'jpeg',
  'png',
  'webp',
] as const

export const ACCEPT_STRING = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

export const FORMAT_LABELS: Record<DocumentFormat, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  txt: 'TXT',
  docx: 'DOCX',
  rtf: 'RTF',
  cbz: 'CBZ',
  cbr: 'CBR',
  cb7: 'CB7',
  cbt: 'CBT',
  zip: 'ZIP',
  image: 'IMAGE',
}

export const FORMAT_TONES: Record<DocumentFormat, string> = {
  pdf: '#f27676',
  epub: '#8f9cff',
  txt: '#75d6b0',
  docx: '#73b4ee',
  rtf: '#e9b968',
  cbz: '#f39a58',
  cbr: '#e97898',
  cb7: '#c795f4',
  cbt: '#75c8d8',
  zip: '#c6cf8a',
  image: '#72d8cb',
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'])
const COMIC_EXTENSIONS = new Set(['cbz', 'cbr', 'cb7', 'cbt', 'zip'])

export function extensionOf(fileName: string): string {
  const clean = fileName.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
}

export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export function formatForExtension(extension: string): DocumentFormat | null {
  const ext = extension.toLowerCase()
  if (ext === 'pdf' || ext === 'epub' || ext === 'txt' || ext === 'docx' || ext === 'rtf') {
    return ext
  }
  if (COMIC_EXTENSIONS.has(ext)) return ext as DocumentFormat
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return null
}

export function formatLabel(format: DocumentFormat, extension = ''): string {
  if (format === 'image') return (extension || 'IMAGE').toUpperCase()
  return FORMAT_LABELS[format]
}

export function categoryOf(format: DocumentFormat): DocumentCategory {
  if (format === 'pdf') return 'pdf'
  if (format === 'epub') return 'epub'
  if (format === 'txt' || format === 'docx' || format === 'rtf') return 'text'
  if (format === 'image') return 'image'
  return 'comic'
}

export function categoryLabel(category: DocumentCategory): string {
  switch (category) {
    case 'pdf':
      return 'PDF'
    case 'epub':
      return 'EPUB'
    case 'comic':
      return 'Comics'
    case 'text':
      return 'Text Documents'
    case 'image':
      return 'Image Collections'
  }
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(fileName))
}

export function isArchiveImageName(fileName: string): boolean {
  const ext = extensionOf(fileName)
  return IMAGE_EXTENSIONS.has(ext)
}

export function readingStatus(document: Pick<DocumentMeta, 'progress' | 'completedAt'>): ReadingStatus {
  if (document.completedAt || document.progress >= 0.995) return 'completed'
  if (document.progress > 0) return 'reading'
  return 'unread'
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(progress: number): string {
  const value = clamp(progress) * 100
  if (value > 0 && value < 1) return '<1%'
  return `${Math.round(value)}%`
}

export function formatDate(iso: string | null | undefined, language = 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(iso: string | null | undefined, language = 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function relativeTime(iso: string | null | undefined, language = 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso).getTime()
  if (Number.isNaN(date)) return '—'
  const delta = date - Date.now()
  const abs = Math.abs(delta)
  const rtf = new Intl.RelativeTimeFormat(language === 'id' ? 'id' : 'en', { numeric: 'auto' })
  if (abs < 60_000) return rtf.format(Math.round(delta / 1000), 'second')
  if (abs < 3_600_000) return rtf.format(Math.round(delta / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(delta / 3_600_000), 'hour')
  if (abs < 2_592_000_000) return rtf.format(Math.round(delta / 86_400_000), 'day')
  if (abs < 31_536_000_000) return rtf.format(Math.round(delta / 2_592_000_000), 'month')
  return rtf.format(Math.round(delta / 31_536_000_000), 'year')
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function dayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function readerLocation(
  type: ReaderLocation['type'],
  value: string | number,
  percentage: number,
  label: string,
  page?: number,
): ReaderLocation {
  return {
    type,
    value: String(value),
    percentage: clamp(percentage),
    label,
    ...(page !== undefined ? { page } : {}),
  }
}

export function encodeLocation(location: ReaderLocation | null | undefined): string | null {
  if (!location) return null
  return encodeURIComponent(JSON.stringify(location))
}

export function parseLocationParam(value: string | null): ReaderLocation | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as ReaderLocation
    if (!parsed || typeof parsed.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function titleFromFileName(fileName: string): string {
  return baseName(fileName)
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
