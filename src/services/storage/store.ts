import type {
  AppState,
  Bookmark,
  Collection,
  DocumentMeta,
  HistoryEntry,
  Note,
  ProgressUpdate,
  ReadingStats,
  Series,
  Settings,
  FileEntry,
} from '../../types'
import { clamp, dayKey, uid } from '../../utils/format'

const KEYS = {
  documents: 'ezreader.documents.v1',
  covers: 'ezreader.covers.v1',
  library: 'ezreader.library.v1',
  activity: 'ezreader.activity.v1',
  settings: 'ezreader.settings.v1',
} as const

type Slice = keyof typeof KEYS

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'en',
  defaultView: 'grid',
  defaultSort: 'added-desc',
  accent: 'mint',
  gridSize: 'comfortable',
  reader: {
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.7,
    background: 'dark',
    pdfZoom: 1,
    pdfZoomPreset: 'fit-width',
    comicLayout: 'single',
    readingDirection: 'ltr',
    margin: 48,
  },
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`EZReader could not persist ${key}`, error)
    return false
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeSettings(value: unknown): Settings {
  const partial = (value && typeof value === 'object' ? value : {}) as Partial<Settings>
  const reader = (partial.reader && typeof partial.reader === 'object' ? partial.reader : {}) as Partial<Settings['reader']>
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    reader: {
      ...DEFAULT_SETTINGS.reader,
      ...reader,
      fontSize: Math.min(48, Math.max(10, Number(reader.fontSize) || DEFAULT_SETTINGS.reader.fontSize)),
      lineHeight: Math.min(3, Math.max(1, Number(reader.lineHeight) || DEFAULT_SETTINGS.reader.lineHeight)),
      pdfZoom: Math.min(5, Math.max(0.25, Number(reader.pdfZoom) || DEFAULT_SETTINGS.reader.pdfZoom)),
      margin: Math.min(140, Math.max(8, Number(reader.margin) || DEFAULT_SETTINGS.reader.margin)),
    },
  }
}

function normalizeDocument(doc: Partial<DocumentMeta>): DocumentMeta | null {
  if (!doc || typeof doc.id !== 'string' || typeof doc.title !== 'string' || typeof doc.format !== 'string') {
    return null
  }
  return {
    id: doc.id,
    fileName: doc.fileName ?? doc.title,
    title: doc.title,
    format: doc.format,
    extension: doc.extension ?? '',
    mimeType: doc.mimeType ?? '',
    size: Number(doc.size) || 0,
    lastModified: Number(doc.lastModified) || 0,
    addedAt: doc.addedAt ?? new Date().toISOString(),
    lastOpenedAt: doc.lastOpenedAt ?? null,
    progress: clamp(Number(doc.progress) || 0),
    lastPage: Math.max(0, Number(doc.lastPage) || 0),
    totalPages: Math.max(0, Number(doc.totalPages) || 0),
    furthestPage: Math.max(0, Number(doc.furthestPage) || Number(doc.lastPage) || 0),
    lastLocation: doc.lastLocation ?? null,
    favorite: Boolean(doc.favorite),
    completedAt: doc.completedAt ?? null,
  }
}

function loadState(): AppState {
  const documents = asArray<Partial<DocumentMeta>>(readJSON(KEYS.documents, []))
    .map(normalizeDocument)
    .filter((doc): doc is DocumentMeta => Boolean(doc))
  const library = readJSON<{ collections?: Collection[]; series?: Series[] }>(KEYS.library, {})
  const activity = readJSON<{
    bookmarks?: Bookmark[]
    notes?: Note[]
    history?: HistoryEntry[]
    stats?: ReadingStats
  }>(KEYS.activity, {})
  return {
    documents,
    covers: readJSON<Record<string, string>>(KEYS.covers, {}),
    collections: asArray<Collection>(library.collections),
    series: asArray<Series>(library.series),
    bookmarks: asArray<Bookmark>(activity.bookmarks),
    notes: asArray<Note>(activity.notes),
    history: asArray<HistoryEntry>(activity.history),
    stats: activity.stats && typeof activity.stats.days === 'object' ? activity.stats : { days: {} },
    settings: normalizeSettings(readJSON(KEYS.settings, DEFAULT_SETTINGS)),
  }
}

function historyStatus(progress: number, completedAt: string | null) {
  if (completedAt || progress >= 0.995) return 'completed' as const
  if (progress > 0) return 'reading' as const
  return 'unread' as const
}

function updateHistory(
  history: HistoryEntry[],
  document: DocumentMeta,
  now: string,
  opened = false,
): HistoryEntry[] {
  const existing = history.find((item) => item.documentId === document.id)
  const entry: HistoryEntry = {
    documentId: document.id,
    lastOpenedAt: opened || !existing ? now : existing.lastOpenedAt,
    lastReadAt: now,
    progress: document.progress,
    lastPage: document.lastPage,
    totalPages: document.totalPages,
    status: historyStatus(document.progress, document.completedAt),
    location: document.lastLocation,
  }
  return [entry, ...history.filter((item) => item.documentId !== document.id)]
}

class AppStore {
  private state: AppState
  private listeners = new Set<() => void>()
  private saveErrorNotified = false

  constructor() {
    this.state = loadState()
    window.addEventListener('beforeunload', () => {
      // All writes are synchronous, but this also makes the intent explicit.
      this.persist('documents')
    })
  }

  getState = (): AppState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }

  private persist(...slices: Slice[]) {
    let ok = true
    for (const slice of slices) {
      if (slice === 'documents') ok = writeJSON(KEYS.documents, this.state.documents) && ok
      if (slice === 'covers') ok = writeJSON(KEYS.covers, this.state.covers) && ok
      if (slice === 'library') {
        ok =
          writeJSON(KEYS.library, {
            collections: this.state.collections,
            series: this.state.series,
          }) && ok
      }
      if (slice === 'activity') {
        ok =
          writeJSON(KEYS.activity, {
            bookmarks: this.state.bookmarks,
            notes: this.state.notes,
            history: this.state.history,
            stats: this.state.stats,
          }) && ok
      }
      if (slice === 'settings') ok = writeJSON(KEYS.settings, this.state.settings) && ok
    }
    if (!ok && !this.saveErrorNotified) {
      this.saveErrorNotified = true
      window.dispatchEvent(
        new CustomEvent('ezreader:storage-error', {
          detail: 'Your browser storage is full. Metadata changes could not be saved.',
        }),
      )
    }
  }

  private set(next: AppState, ...slices: Slice[]) {
    this.state = next
    this.persist(...slices)
    this.emit()
  }

  addDocuments(documents: DocumentMeta[], covers: Record<string, string> = {}) {
    if (!documents.length) return
    this.set(
      {
        ...this.state,
        documents: [...documents, ...this.state.documents],
        covers: { ...this.state.covers, ...covers },
      },
      'documents',
      'covers',
    )
  }

  updateDocument(documentId: string, patch: Partial<DocumentMeta>) {
    const documents = this.state.documents.map((doc) =>
      doc.id === documentId ? { ...doc, ...patch } : doc,
    )
    this.set({ ...this.state, documents }, 'documents')
  }

  setDocumentCover(documentId: string, cover: string | null) {
    const covers = { ...this.state.covers }
    if (cover) covers[documentId] = cover
    else delete covers[documentId]
    this.set({ ...this.state, covers }, 'covers')
  }

  removeDocuments(documentIds: string[]) {
    if (!documentIds.length) return
    const ids = new Set(documentIds)
    const covers = { ...this.state.covers }
    ids.forEach((id) => delete covers[id])
    this.set(
      {
        ...this.state,
        documents: this.state.documents.filter((doc) => !ids.has(doc.id)),
        covers,
        collections: this.state.collections.map((collection) => ({
          ...collection,
          documentIds: collection.documentIds.filter((id) => !ids.has(id)),
        })),
        series: this.state.series.map((series) => ({
          ...series,
          documentIds: series.documentIds.filter((id) => !ids.has(id)),
        })),
        bookmarks: this.state.bookmarks.filter((bookmark) => !ids.has(bookmark.documentId)),
        notes: this.state.notes.filter((note) => !ids.has(note.documentId)),
        history: this.state.history.filter((entry) => !ids.has(entry.documentId)),
      },
      'documents',
      'covers',
      'library',
      'activity',
    )
  }

  toggleFavorite(documentId: string) {
    const documents = this.state.documents.map((doc) =>
      doc.id === documentId ? { ...doc, favorite: !doc.favorite } : doc,
    )
    this.set({ ...this.state, documents }, 'documents')
  }

  markOpened(documentId: string) {
    const now = new Date().toISOString()
    const documents = this.state.documents.map((doc) =>
      doc.id === documentId ? { ...doc, lastOpenedAt: now } : doc,
    )
    const document = documents.find((doc) => doc.id === documentId)
    if (!document) return
    this.set(
      {
        ...this.state,
        documents,
        history: updateHistory(this.state.history, document, now, true),
      },
      'documents',
      'activity',
    )
  }

  updateProgress(documentId: string, update: ProgressUpdate) {
    const now = new Date().toISOString()
    const documents = this.state.documents.map((doc) => {
      if (doc.id !== documentId) return doc
      const progress = clamp(Number(update.progress) || 0)
      const totalPages = Math.max(0, Math.round(update.totalPages || 0))
      const lastPage = Math.max(0, Math.round(update.lastPage || 0))
      const completedAt =
        progress >= 0.995 ? doc.completedAt ?? now : doc.completedAt
      return {
        ...doc,
        progress,
        lastPage,
        totalPages,
        furthestPage: Math.max(doc.furthestPage, lastPage),
        lastLocation: update.location,
        completedAt,
      }
    })
    const document = documents.find((doc) => doc.id === documentId)
    if (!document) return
    const previous = this.state.documents.find((doc) => doc.id === documentId)
    const pageDelta = Math.max(0, document.furthestPage - (previous?.furthestPage ?? 0))
    let stats = this.state.stats
    if (pageDelta > 0) {
      const key = dayKey()
      const previousDay = stats.days[key] ?? { seconds: 0, pages: 0 }
      stats = {
        ...stats,
        days: {
          ...stats.days,
          [key]: { ...previousDay, pages: previousDay.pages + pageDelta },
        },
      }
    }
    this.set(
      {
        ...this.state,
        documents,
        history: updateHistory(this.state.history, document, now),
        stats,
      },
      'documents',
      'activity',
    )
  }

  recordReadingTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const key = dayKey()
    const previous = this.state.stats.days[key] ?? { seconds: 0, pages: 0 }
    const stats: ReadingStats = {
      ...this.state.stats,
      days: {
        ...this.state.stats.days,
        [key]: { ...previous, seconds: previous.seconds + seconds },
      },
    }
    this.set({ ...this.state, stats }, 'activity')
  }

  createCollection(input: {
    name: string
    description?: string
    documentIds?: string[]
    coverMode?: Collection['coverMode']
    coverDocumentId?: string
    coverData?: string
  }): string {
    const now = new Date().toISOString()
    const collection: Collection = {
      id: uid('col'),
      name: input.name.trim() || 'Untitled collection',
      description: input.description?.trim() ?? '',
      documentIds: input.documentIds ?? [],
      coverMode: input.coverMode ?? 'auto',
      coverDocumentId: input.coverDocumentId,
      coverData: input.coverData,
      createdAt: now,
      updatedAt: now,
    }
    this.set(
      { ...this.state, collections: [...this.state.collections, collection] },
      'library',
    )
    return collection.id
  }

  updateCollection(collectionId: string, patch: Partial<Collection>) {
    this.set(
      {
        ...this.state,
        collections: this.state.collections.map((collection) =>
          collection.id === collectionId
            ? { ...collection, ...patch, updatedAt: new Date().toISOString() }
            : collection,
        ),
      },
      'library',
    )
  }

  deleteCollection(collectionId: string) {
    this.set(
      {
        ...this.state,
        collections: this.state.collections.filter((collection) => collection.id !== collectionId),
      },
      'library',
    )
  }

  addDocumentsToCollection(collectionId: string, documentIds: string[]) {
    this.set(
      {
        ...this.state,
        collections: this.state.collections.map((collection) => {
          if (collection.id !== collectionId) return collection
          return {
            ...collection,
            documentIds: Array.from(new Set([...collection.documentIds, ...documentIds])),
            updatedAt: new Date().toISOString(),
          }
        }),
      },
      'library',
    )
  }

  removeDocumentsFromCollection(collectionId: string, documentIds: string[]) {
    const ids = new Set(documentIds)
    this.set(
      {
        ...this.state,
        collections: this.state.collections.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                documentIds: collection.documentIds.filter((id) => !ids.has(id)),
                updatedAt: new Date().toISOString(),
              }
            : collection,
        ),
      },
      'library',
    )
  }

  createSeries(input: {
    name: string
    description?: string
    documentIds?: string[]
    coverMode?: Series['coverMode']
    coverDocumentId?: string
    coverData?: string
  }): string {
    const now = new Date().toISOString()
    const series: Series = {
      id: uid('series'),
      name: input.name.trim() || 'Untitled series',
      description: input.description?.trim() ?? '',
      documentIds: input.documentIds ?? [],
      coverMode: input.coverMode ?? 'auto',
      coverDocumentId: input.coverDocumentId,
      coverData: input.coverData,
      createdAt: now,
      updatedAt: now,
    }
    this.set({ ...this.state, series: [...this.state.series, series] }, 'library')
    return series.id
  }

  updateSeries(seriesId: string, patch: Partial<Series>) {
    this.set(
      {
        ...this.state,
        series: this.state.series.map((series) =>
          series.id === seriesId
            ? { ...series, ...patch, updatedAt: new Date().toISOString() }
            : series,
        ),
      },
      'library',
    )
  }

  deleteSeries(seriesId: string) {
    this.set(
      { ...this.state, series: this.state.series.filter((series) => series.id !== seriesId) },
      'library',
    )
  }

  addDocumentsToSeries(seriesId: string, documentIds: string[]) {
    this.set(
      {
        ...this.state,
        series: this.state.series.map((series) => {
          if (series.id !== seriesId) return series
          return {
            ...series,
            documentIds: Array.from(new Set([...series.documentIds, ...documentIds])),
            updatedAt: new Date().toISOString(),
          }
        }),
      },
      'library',
    )
  }

  removeDocumentsFromSeries(seriesId: string, documentIds: string[]) {
    const ids = new Set(documentIds)
    this.set(
      {
        ...this.state,
        series: this.state.series.map((series) =>
          series.id === seriesId
            ? {
                ...series,
                documentIds: series.documentIds.filter((id) => !ids.has(id)),
                updatedAt: new Date().toISOString(),
              }
            : series,
        ),
      },
      'library',
    )
  }

  reorderSeries(seriesId: string, documentIds: string[]) {
    this.set(
      {
        ...this.state,
        series: this.state.series.map((series) =>
          series.id === seriesId
            ? { ...series, documentIds, updatedAt: new Date().toISOString() }
            : series,
        ),
      },
      'library',
    )
  }

  addBookmark(input: Omit<Bookmark, 'id' | 'createdAt'>): string {
    const bookmark: Bookmark = {
      ...input,
      id: uid('bm'),
      createdAt: new Date().toISOString(),
    }
    this.set({ ...this.state, bookmarks: [bookmark, ...this.state.bookmarks] }, 'activity')
    return bookmark.id
  }

  renameBookmark(bookmarkId: string, name: string) {
    this.set(
      {
        ...this.state,
        bookmarks: this.state.bookmarks.map((bookmark) =>
          bookmark.id === bookmarkId ? { ...bookmark, name: name.trim() || bookmark.name } : bookmark,
        ),
      },
      'activity',
    )
  }

  deleteBookmark(bookmarkId: string) {
    this.set(
      { ...this.state, bookmarks: this.state.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId) },
      'activity',
    )
  }

  addNote(input: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): string {
    const now = new Date().toISOString()
    const note: Note = { ...input, id: uid('note'), createdAt: now, updatedAt: now }
    this.set({ ...this.state, notes: [note, ...this.state.notes] }, 'activity')
    return note.id
  }

  updateNote(noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'location'>>) {
    this.set(
      {
        ...this.state,
        notes: this.state.notes.map((note) =>
          note.id === noteId
            ? { ...note, ...patch, updatedAt: new Date().toISOString() }
            : note,
        ),
      },
      'activity',
    )
  }

  deleteNote(noteId: string) {
    this.set(
      { ...this.state, notes: this.state.notes.filter((note) => note.id !== noteId) },
      'activity',
    )
  }

  removeHistory(documentIds: string[]) {
    const ids = new Set(documentIds)
    this.set(
      {
        ...this.state,
        history: this.state.history.filter((entry) => !ids.has(entry.documentId)),
      },
      'activity',
    )
  }

  clearHistory() {
    this.set({ ...this.state, history: [] }, 'activity')
  }

  updateSettings(patch: Partial<Settings>) {
    const next = normalizeSettings({ ...this.state.settings, ...patch })
    this.set({ ...this.state, settings: next }, 'settings')
  }

  updateReaderSettings(patch: Partial<Settings['reader']>) {
    const next = normalizeSettings({
      ...this.state.settings,
      reader: { ...this.state.settings.reader, ...patch },
    })
    this.set({ ...this.state, settings: next }, 'settings')
  }

  resetSettings() {
    this.set({ ...this.state, settings: { ...DEFAULT_SETTINGS, reader: { ...DEFAULT_SETTINGS.reader } } }, 'settings')
  }

  replaceState(next: AppState) {
    this.state = next
    this.persist('documents', 'covers', 'library', 'activity', 'settings')
    this.emit()
  }

  clearAllData() {
    const next: AppState = {
      documents: [],
      covers: {},
      collections: [],
      series: [],
      bookmarks: [],
      notes: [],
      history: [],
      stats: { days: {} },
      settings: { ...DEFAULT_SETTINGS, reader: { ...DEFAULT_SETTINGS.reader } },
    }
    this.state = next
    Object.values(KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore storage access failures while resetting.
      }
    })
    this.emit()
  }

  exportState(): AppState {
    return structuredClone(this.state)
  }
}

export const store = new AppStore()

/* ------------------------------------------------------------------ */
/* Runtime file registry                                                */
/* Files are intentionally never written to localStorage or IndexedDB. */
/* ------------------------------------------------------------------ */

const fileEntries = new Map<string, FileEntry>()
const fileListeners = new Set<() => void>()
let fileRegistryVersion = 0

function announceFileChange() {
  fileRegistryVersion += 1
  fileListeners.forEach((listener) => listener())
}

export const fileRegistry = {
  set(documentId: string, entry: FileEntry) {
    fileEntries.set(documentId, entry)
    announceFileChange()
  },
  get(documentId: string): FileEntry | undefined {
    return fileEntries.get(documentId)
  },
  remove(documentId: string) {
    fileEntries.delete(documentId)
    announceFileChange()
  },
  clear() {
    fileEntries.clear()
    announceFileChange()
  },
  has(documentId: string): boolean {
    return fileEntries.has(documentId)
  },
  subscribe(listener: () => void) {
    fileListeners.add(listener)
    return () => fileListeners.delete(listener)
  },
  snapshot(): number {
    return fileRegistryVersion
  },
  entries(): Array<[string, FileEntry]> {
    return Array.from(fileEntries.entries())
  },
}

export { KEYS as STORAGE_KEYS }
