export type DocumentFormat =
  | 'pdf'
  | 'epub'
  | 'txt'
  | 'docx'
  | 'rtf'
  | 'cbz'
  | 'cbr'
  | 'cb7'
  | 'cbt'
  | 'zip'
  | 'image'

export type DocumentCategory = 'pdf' | 'epub' | 'comic' | 'text' | 'image'

export type ReadingStatus = 'unread' | 'reading' | 'completed'

export type ThemeMode = 'dark' | 'light' | 'system'
export type Language = 'en' | 'id'
export type ViewMode = 'grid' | 'list'
export type AccentColor = 'mint' | 'violet' | 'sky' | 'amber' | 'rose'
export type GridSize = 'compact' | 'comfortable' | 'large'
export type ReaderBackground = 'dark' | 'black' | 'sepia' | 'light'
export type ComicLayout = 'single' | 'double' | 'vertical'
export type ReadingDirection = 'ltr' | 'rtl'
export type SortKey = 'added-desc' | 'added-asc' | 'title-asc' | 'title-desc' | 'opened-desc' | 'format-asc' | 'progress-desc'
export type FontFamily = 'serif' | 'sans' | 'mono'
export type PdfZoomPreset = 'fit-width' | 'fit-page' | 'actual'

export interface ReaderLocation {
  type: 'pdf-page' | 'epub-cfi' | 'comic-page' | 'scroll' | 'image'
  value: string
  page?: number
  percentage: number
  label: string
}

export interface DocumentMeta {
  id: string
  fileName: string
  title: string
  format: DocumentFormat
  extension: string
  mimeType: string
  size: number
  lastModified: number
  addedAt: string
  lastOpenedAt: string | null
  progress: number
  lastPage: number
  totalPages: number
  furthestPage: number
  lastLocation: ReaderLocation | null
  favorite: boolean
  completedAt: string | null
}

export interface Collection {
  id: string
  name: string
  description: string
  documentIds: string[]
  coverMode: 'auto' | 'custom' | 'document'
  coverDocumentId?: string
  coverData?: string
  createdAt: string
  updatedAt: string
}

export interface Series {
  id: string
  name: string
  description: string
  documentIds: string[]
  coverMode: 'auto' | 'custom' | 'document'
  coverDocumentId?: string
  coverData?: string
  createdAt: string
  updatedAt: string
}

export interface Bookmark {
  id: string
  documentId: string
  name: string
  location: ReaderLocation
  createdAt: string
}

export interface Note {
  id: string
  documentId: string
  title: string
  content: string
  location: ReaderLocation
  createdAt: string
  updatedAt: string
}

export interface HistoryEntry {
  documentId: string
  lastOpenedAt: string
  lastReadAt: string
  progress: number
  lastPage: number
  totalPages: number
  status: ReadingStatus
  location: ReaderLocation | null
}

export interface ReadingDay {
  seconds: number
  pages: number
}

export interface ReadingStats {
  days: Record<string, ReadingDay>
}

export interface ReaderPreferences {
  fontFamily: FontFamily
  fontSize: number
  lineHeight: number
  background: ReaderBackground
  pdfZoom: number
  pdfZoomPreset: PdfZoomPreset
  comicLayout: ComicLayout
  readingDirection: ReadingDirection
  margin: number
}

export interface Settings {
  theme: ThemeMode
  language: Language
  defaultView: ViewMode
  defaultSort: SortKey
  accent: AccentColor
  gridSize: GridSize
  keepFiles: boolean
  reader: ReaderPreferences
}

export interface AppState {
  documents: DocumentMeta[]
  covers: Record<string, string>
  collections: Collection[]
  series: Series[]
  bookmarks: Bookmark[]
  notes: Note[]
  history: HistoryEntry[]
  stats: ReadingStats
  settings: Settings
}

export interface ProgressUpdate {
  progress: number
  lastPage: number
  totalPages: number
  location: ReaderLocation | null
}

export type ImportResult = {
  added: DocumentMeta[]
  skipped: Array<{ fileName: string; reason: string }>
}

export type BackupKind =
  | 'full'
  | 'collections'
  | 'series'
  | 'bookmarks'
  | 'notes'
  | 'history'
  | 'favorites'

export interface BackupEnvelope {
  app: 'EZReader'
  format: 'ezreader-backup'
  version: 1
  kind: BackupKind
  exportedAt: string
  note: string
  data: Record<string, unknown>
}

export interface FileEntry {
  file: File
  handle?: FileSystemFileHandle
}
