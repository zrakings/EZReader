import type {
  AppState,
  BackupEnvelope,
  BackupKind,
  Bookmark,
  Collection,
  DocumentMeta,
  HistoryEntry,
  Note,
  ReadingStats,
  ReaderLocation,
  Series,
  Settings,
} from '../types'
import { clamp, dayKey } from '../utils/format'

const APP = 'EZReader' as const
const FORMAT = 'ezreader-backup' as const
const VERSION = 1 as const

const KINDS: BackupKind[] = [
  'full',
  'collections',
  'series',
  'bookmarks',
  'notes',
  'history',
  'favorites',
]

export interface BackupCounts {
  documents: number
  collections: number
  series: number
  bookmarks: number
  notes: number
  history: number
  favorites: number
}

export interface ImportSummary {
  documents: number
  collections: number
  series: number
  bookmarks: number
  notes: number
  history: number
  skipped: number
}

export interface ApplyBackupResult {
  state: AppState
  summary: ImportSummary
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function countBackup(envelope: BackupEnvelope): BackupCounts {
  const data = envelope.data ?? {}
  const documents = Array.isArray(data.documents) ? data.documents.length : 0
  const collections = Array.isArray(data.collections) ? data.collections.length : 0
  const series = Array.isArray(data.series) ? data.series.length : 0
  const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks.length : 0
  const notes = Array.isArray(data.notes) ? data.notes.length : 0
  const history = Array.isArray(data.history) ? data.history.length : 0
  const favorites = Array.isArray(data.favorites)
    ? data.favorites.length
    : documents > 0
      ? 0
      : 0
  return { documents, collections, series, bookmarks, notes, history, favorites }
}

export function buildBackup(kind: BackupKind, state: AppState): BackupEnvelope {
  let data: Record<string, unknown> = {}
  if (kind === 'full') {
    data = {
      documents: clone(state.documents),
      covers: clone(state.covers),
      collections: clone(state.collections),
      series: clone(state.series),
      bookmarks: clone(state.bookmarks),
      notes: clone(state.notes),
      history: clone(state.history),
      stats: clone(state.stats),
      settings: clone(state.settings),
    }
  } else if (kind === 'collections') {
    data = { collections: clone(state.collections) }
  } else if (kind === 'series') {
    data = { series: clone(state.series) }
  } else if (kind === 'bookmarks') {
    data = { bookmarks: clone(state.bookmarks) }
  } else if (kind === 'notes') {
    data = { notes: clone(state.notes) }
  } else if (kind === 'history') {
    data = { history: clone(state.history), stats: clone(state.stats) }
  } else {
    data = { favorites: state.documents.filter((doc) => doc.favorite).map((doc) => doc.id) }
  }

  return {
    app: APP,
    format: FORMAT,
    version: VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    note:
      'This backup contains library metadata only. Original document files stay on your device and are not included.',
    data,
  }
}

export function backupFileName(kind: BackupKind): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `ezreader-${kind}-${stamp}.json`
}

export function downloadBackup(envelope: BackupEnvelope): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(envelope.kind)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function parseBackup(text: string): BackupEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('This file does not contain an EZReader backup.')
  }
  const candidate = parsed as Partial<BackupEnvelope>
  if (candidate.app !== APP || candidate.format !== FORMAT) {
    throw new Error('This is not an EZReader metadata backup.')
  }
  if (candidate.version !== VERSION) {
    throw new Error(`Backup version ${String(candidate.version)} is not supported.`)
  }
  if (!candidate.kind || !KINDS.includes(candidate.kind)) {
    throw new Error('The backup kind is missing or unknown.')
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    throw new Error('The backup does not contain any metadata.')
  }
  return candidate as BackupEnvelope
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function safeLocation(value: unknown): ReaderLocation | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (!isString(candidate.type) || !isString(candidate.value)) return null
  const allowed: ReaderLocation['type'][] = [
    'pdf-page',
    'epub-cfi',
    'comic-page',
    'scroll',
    'image',
  ]
  if (!allowed.includes(candidate.type as ReaderLocation['type'])) return null
  return {
    type: candidate.type as ReaderLocation['type'],
    value: candidate.value,
    percentage: clamp(Number(candidate.percentage) || 0),
    label: isString(candidate.label) ? candidate.label : '',
    page: Number.isFinite(Number(candidate.page)) ? Number(candidate.page) : undefined,
  }
}

function sanitizeDocument(value: unknown): DocumentMeta | null {
  if (!value || typeof value !== 'object') return null
  const doc = value as Partial<DocumentMeta>
  if (!isString(doc.id) || !isString(doc.title) || !isString(doc.format)) return null
  return {
    id: doc.id,
    fileName: isString(doc.fileName) ? doc.fileName : doc.title,
    title: doc.title,
    format: doc.format,
    extension: isString(doc.extension) ? doc.extension : '',
    mimeType: isString(doc.mimeType) ? doc.mimeType : '',
    size: Number(doc.size) || 0,
    lastModified: Number(doc.lastModified) || 0,
    addedAt: isString(doc.addedAt) ? doc.addedAt : new Date().toISOString(),
    lastOpenedAt: isString(doc.lastOpenedAt) ? doc.lastOpenedAt : null,
    progress: clamp(Number(doc.progress) || 0),
    lastPage: Math.max(0, Number(doc.lastPage) || 0),
    totalPages: Math.max(0, Number(doc.totalPages) || 0),
    furthestPage: Math.max(0, Number(doc.furthestPage) || Number(doc.lastPage) || 0),
    lastLocation: safeLocation(doc.lastLocation),
    favorite: Boolean(doc.favorite),
    completedAt: isString(doc.completedAt) ? doc.completedAt : null,
  }
}

function sanitizeCollection(value: unknown): Collection | null {
  if (!value || typeof value !== 'object') return null
  const group = value as Partial<Collection>
  if (!isString(group.id) || !isString(group.name)) return null
  return {
    id: group.id,
    name: group.name,
    description: isString(group.description) ? group.description : '',
    documentIds: asArray(group.documentIds).filter(isString),
    coverMode:
      group.coverMode === 'custom' || group.coverMode === 'document' ? group.coverMode : 'auto',
    coverDocumentId: isString(group.coverDocumentId) ? group.coverDocumentId : undefined,
    coverData: isString(group.coverData) ? group.coverData : undefined,
    createdAt: isString(group.createdAt) ? group.createdAt : new Date().toISOString(),
    updatedAt: isString(group.updatedAt) ? group.updatedAt : new Date().toISOString(),
  }
}

function sanitizeSeries(value: unknown): Series | null {
  const collection = sanitizeCollection(value)
  return collection ? (collection as Series) : null
}

function sanitizeBookmark(value: unknown): Bookmark | null {
  if (!value || typeof value !== 'object') return null
  const bookmark = value as Partial<Bookmark>
  if (!isString(bookmark.id) || !isString(bookmark.documentId)) return null
  return {
    id: bookmark.id,
    documentId: bookmark.documentId,
    name: isString(bookmark.name) ? bookmark.name : 'Bookmark',
    location:
      safeLocation(bookmark.location) ?? {
        type: 'scroll',
        value: '0',
        percentage: 0,
        label: '',
      },
    createdAt: isString(bookmark.createdAt) ? bookmark.createdAt : new Date().toISOString(),
  }
}

function sanitizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null
  const note = value as Partial<Note>
  if (!isString(note.id) || !isString(note.documentId)) return null
  return {
    id: note.id,
    documentId: note.documentId,
    title: isString(note.title) ? note.title : 'Note',
    content: isString(note.content) ? note.content : '',
    location:
      safeLocation(note.location) ?? {
        type: 'scroll',
        value: '0',
        percentage: 0,
        label: '',
      },
    createdAt: isString(note.createdAt) ? note.createdAt : new Date().toISOString(),
    updatedAt: isString(note.updatedAt) ? note.updatedAt : new Date().toISOString(),
  }
}

function sanitizeHistory(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<HistoryEntry>
  if (!isString(entry.documentId)) return null
  const progress = clamp(Number(entry.progress) || 0)
  return {
    documentId: entry.documentId,
    lastOpenedAt: isString(entry.lastOpenedAt)
      ? entry.lastOpenedAt
      : isString(entry.lastReadAt)
        ? entry.lastReadAt
        : new Date().toISOString(),
    lastReadAt: isString(entry.lastReadAt) ? entry.lastReadAt : new Date().toISOString(),
    progress,
    lastPage: Math.max(0, Number(entry.lastPage) || 0),
    totalPages: Math.max(0, Number(entry.totalPages) || 0),
    status:
      entry.status === 'completed' || entry.status === 'reading' || entry.status === 'unread'
        ? entry.status
        : progress >= 0.995
          ? 'completed'
          : progress > 0
            ? 'reading'
            : 'unread',
    location: safeLocation(entry.location),
  }
}

function sanitizeStats(value: unknown): ReadingStats {
  if (!value || typeof value !== 'object') return { days: {} }
  const raw = (value as ReadingStats).days
  if (!raw || typeof raw !== 'object') return { days: {} }
  const days: ReadingStats['days'] = {}
  for (const [key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    days[key] = {
      seconds: Math.max(0, Number(entry.seconds) || 0),
      pages: Math.max(0, Math.round(Number(entry.pages) || 0)),
    }
  }
  return { days }
}

function sanitizeSettings(value: unknown, fallback: Settings): Settings {
  if (!value || typeof value !== 'object') return fallback
  const incoming = value as Partial<Settings>
  return {
    ...fallback,
    ...incoming,
    reader: {
      ...fallback.reader,
      ...(incoming.reader && typeof incoming.reader === 'object' ? incoming.reader : {}),
    },
  }
}

function mergeDocument(current: DocumentMeta, incoming: DocumentMeta): DocumentMeta {
  const laterOpened =
    (incoming.lastOpenedAt ?? '') > (current.lastOpenedAt ?? '') ? incoming : current
  return {
    ...current,
    title: incoming.title || current.title,
    fileName: current.fileName || incoming.fileName,
    size: current.size || incoming.size,
    lastModified: current.lastModified || incoming.lastModified,
    addedAt:
      current.addedAt && incoming.addedAt
        ? current.addedAt < incoming.addedAt
          ? current.addedAt
          : incoming.addedAt
        : current.addedAt || incoming.addedAt,
    lastOpenedAt: laterOpened.lastOpenedAt,
    progress: Math.max(current.progress, incoming.progress),
    lastPage: Math.max(current.lastPage, incoming.lastPage),
    totalPages: Math.max(current.totalPages, incoming.totalPages),
    furthestPage: Math.max(current.furthestPage, incoming.furthestPage),
    lastLocation: laterOpened.lastLocation ?? current.lastLocation,
    favorite: current.favorite || incoming.favorite,
    completedAt:
      current.completedAt && incoming.completedAt
        ? current.completedAt < incoming.completedAt
          ? current.completedAt
          : incoming.completedAt
        : current.completedAt || incoming.completedAt,
  }
}

function remapUnique<T extends { id: string }>(
  incoming: T[],
  current: T[],
  idMap: Map<string, string>,
  keyOf: (item: T) => string | null,
  merge: (currentItem: T, incomingItem: T) => T,
): T[] {
  const next = [...current]
  for (const item of incoming) {
    const mappedId = idMap.get(item.id) ?? item.id
    const byId = next.findIndex((candidate) => candidate.id === mappedId)
    const key = keyOf(item)
    const byKey =
      byId >= 0 || !key
        ? -1
        : next.findIndex((candidate) => keyOf(candidate)?.toLowerCase() === key.toLowerCase())
    if (byId >= 0) {
      next[byId] = merge(next[byId], { ...item, id: next[byId].id })
    } else if (byKey >= 0) {
      next[byKey] = merge(next[byKey], { ...item, id: next[byKey].id })
    } else {
      next.push({ ...item, id: mappedId })
    }
  }
  return next
}

function daysWithMerge(current: ReadingStats, incoming: ReadingStats, mode: 'merge' | 'replace'): ReadingStats {
  if (mode === 'replace') return incoming
  const days: ReadingStats['days'] = { ...current.days }
  for (const [key, entry] of Object.entries(incoming.days)) {
    const existing = days[key]
    days[key] = existing
      ? {
          seconds: Math.max(existing.seconds, entry.seconds),
          pages: Math.max(existing.pages, entry.pages),
        }
      : { ...entry }
  }
  return { days }
}

export function applyBackup(
  envelope: BackupEnvelope,
  mode: 'merge' | 'replace',
  current: AppState,
): ApplyBackupResult {
  const data = envelope.data
  const incomingDocuments = asArray(data.documents)
    .map(sanitizeDocument)
    .filter((doc): doc is DocumentMeta => Boolean(doc))
  const incomingCollections = asArray(data.collections)
    .map(sanitizeCollection)
    .filter((item): item is Collection => Boolean(item))
  const incomingSeries = asArray(data.series)
    .map(sanitizeSeries)
    .filter((item): item is Series => Boolean(item))
  const incomingBookmarks = asArray(data.bookmarks)
    .map(sanitizeBookmark)
    .filter((item): item is Bookmark => Boolean(item))
  const incomingNotes = asArray(data.notes)
    .map(sanitizeNote)
    .filter((item): item is Note => Boolean(item))
  const incomingHistory = asArray(data.history)
    .map(sanitizeHistory)
    .filter((item): item is HistoryEntry => Boolean(item))
  const incomingFavorites = asArray(data.favorites).filter(isString)
  const incomingCovers =
    data.covers && typeof data.covers === 'object'
      ? Object.fromEntries(
          Object.entries(data.covers as Record<string, unknown>).filter(
            (entry): entry is [string, string] => isString(entry[1]) && entry[1].startsWith('data:image/'),
          ),
        )
      : {}

  const summary: ImportSummary = {
    documents: 0,
    collections: 0,
    series: 0,
    bookmarks: 0,
    notes: 0,
    history: 0,
    skipped: 0,
  }

  if (mode === 'replace' && envelope.kind === 'full') {
    const documents = incomingDocuments.slice()
    const known = new Set(documents.map((doc) => doc.id))
    const covers: Record<string, string> = {}
    for (const [id, cover] of Object.entries(incomingCovers)) {
      if (known.has(id)) covers[id] = cover
    }
    const keepIds = (ids: string[]) => ids.filter((id) => known.has(id))
    const collections = incomingCollections.map((group) => ({
      ...group,
      documentIds: keepIds(group.documentIds),
      coverDocumentId:
        group.coverDocumentId && known.has(group.coverDocumentId) ? group.coverDocumentId : undefined,
    }))
    const series = incomingSeries.map((group) => ({
      ...group,
      documentIds: keepIds(group.documentIds),
      coverDocumentId:
        group.coverDocumentId && known.has(group.coverDocumentId) ? group.coverDocumentId : undefined,
    }))
    const bookmarks = incomingBookmarks.filter((bookmark) => known.has(bookmark.documentId))
    const notes = incomingNotes.filter((note) => known.has(note.documentId))
    const history = incomingHistory.filter((entry) => known.has(entry.documentId))
    summary.documents = documents.length
    summary.collections = collections.length
    summary.series = series.length
    summary.bookmarks = bookmarks.length
    summary.notes = notes.length
    summary.history = history.length
    return {
      state: {
        ...current,
        documents,
        covers,
        collections,
        series,
        bookmarks,
        notes,
        history,
        stats: sanitizeStats(data.stats),
        settings: sanitizeSettings(data.settings, current.settings),
      },
      summary,
    }
  }

  const documents = [...current.documents]
  const idMap = new Map<string, string>()
  const byFile = new Map(
    documents.map((doc) => [`${doc.fileName.toLowerCase()}::${doc.size}`, doc.id]),
  )

  for (const incoming of incomingDocuments) {
    const matchKey = `${incoming.fileName.toLowerCase()}::${incoming.size}`
    const sameId = documents.find((doc) => doc.id === incoming.id)
    const sameFileId = byFile.get(matchKey)
    const target = sameId ?? (sameFileId ? documents.find((doc) => doc.id === sameFileId) : undefined)
    if (target) {
      idMap.set(incoming.id, target.id)
      const index = documents.findIndex((doc) => doc.id === target.id)
      documents[index] = mergeDocument(target, incoming)
    } else {
      const created = { ...incoming }
      documents.push(created)
      idMap.set(incoming.id, created.id)
      byFile.set(matchKey, created.id)
      summary.documents += 1
    }
  }

  const knownIds = new Set(documents.map((doc) => doc.id))
  const remapId = (id: string) => idMap.get(id) ?? id
  const remapDocumentId = (id: string) => {
    const mapped = remapId(id)
    return knownIds.has(mapped) ? mapped : null
  }

  const covers = { ...current.covers }
  for (const [id, cover] of Object.entries(incomingCovers)) {
    const mapped = remapId(id)
    if (knownIds.has(mapped) && !covers[mapped]) covers[mapped] = cover
  }

  const mergeGroup = <T extends Collection | Series>(existing: T, incoming: T, kind: 'collection' | 'series'): T => {
    const base = existing as Collection
    const nextItem = incoming as Collection
    return {
      ...existing,
      name: existing.name || incoming.name,
      description: existing.description || incoming.description,
      documentIds: Array.from(
        new Set(
          [...base.documentIds, ...nextItem.documentIds]
            .map((id) => remapDocumentId(id))
            .filter((id): id is string => Boolean(id)),
        ),
      ),
      coverMode: existing.coverMode !== 'auto' ? existing.coverMode : incoming.coverMode,
      coverDocumentId:
        existing.coverDocumentId ??
        (incoming.coverDocumentId ? remapDocumentId(incoming.coverDocumentId) ?? undefined : undefined),
      coverData: existing.coverData ?? incoming.coverData,
      updatedAt: new Date().toISOString(),
    } as T
  }

  const mergedCollections = remapUnique(
    incomingCollections,
    current.collections,
    idMap,
    (group) => group.name,
    (existing, incoming) => mergeGroup(existing, incoming, 'collection'),
  ).map((group) => ({
    ...group,
    documentIds: group.documentIds
      .map((id) => remapDocumentId(id))
      .filter((id): id is string => Boolean(id)),
    coverDocumentId: group.coverDocumentId
      ? remapDocumentId(group.coverDocumentId) ?? undefined
      : undefined,
  }))

  const mergedSeries = remapUnique(
    incomingSeries,
    current.series,
    idMap,
    (group) => group.name,
    (existing, incoming) => mergeGroup(existing, incoming, 'series'),
  ).map((group) => ({
    ...group,
    documentIds: group.documentIds
      .map((id) => remapDocumentId(id))
      .filter((id): id is string => Boolean(id)),
    coverDocumentId: group.coverDocumentId
      ? remapDocumentId(group.coverDocumentId) ?? undefined
      : undefined,
  }))

  const bookmarkKey = (bookmark: Bookmark) => `${bookmark.documentId}::${bookmark.location.type}::${bookmark.location.value}`
  const bookmarks = [...current.bookmarks]
  for (const incoming of incomingBookmarks) {
    const documentId = remapDocumentId(incoming.documentId)
    if (!documentId) {
      summary.skipped += 1
      continue
    }
    const candidate = { ...incoming, documentId }
    if (!bookmarks.some((bookmark) => bookmarkKey(bookmark) === bookmarkKey(candidate))) {
      bookmarks.push(candidate)
      summary.bookmarks += 1
    }
  }

  const notes = [...current.notes]
  for (const incoming of incomingNotes) {
    const documentId = remapDocumentId(incoming.documentId)
    if (!documentId) {
      summary.skipped += 1
      continue
    }
    const candidate = { ...incoming, documentId }
    const existingIndex = notes.findIndex((note) => note.id === candidate.id)
    if (existingIndex >= 0) {
      if (candidate.updatedAt > notes[existingIndex].updatedAt) notes[existingIndex] = candidate
    } else {
      notes.push(candidate)
      summary.notes += 1
    }
  }

  const history = [...current.history]
  for (const incoming of incomingHistory) {
    const documentId = remapDocumentId(incoming.documentId)
    if (!documentId) {
      summary.skipped += 1
      continue
    }
    const candidate = { ...incoming, documentId }
    const index = history.findIndex((entry) => entry.documentId === documentId)
    if (index < 0) {
      history.push(candidate)
      summary.history += 1
    } else if (candidate.lastReadAt > history[index].lastReadAt) {
      history[index] = candidate
      summary.history += 1
    }
  }

  if (incomingFavorites.length) {
    for (const id of incomingFavorites) {
      const documentId = remapDocumentId(id)
      if (!documentId) continue
      const index = documents.findIndex((doc) => doc.id === documentId)
      if (index >= 0) documents[index] = { ...documents[index], favorite: true }
    }
  }

  summary.collections = incomingCollections.length
  summary.series = incomingSeries.length

  const stats = data.stats
    ? daysWithMerge(current.stats, sanitizeStats(data.stats), 'merge')
    : current.stats

  return {
    state: {
      ...current,
      documents,
      covers,
      collections: mergedCollections,
      series: mergedSeries,
      bookmarks,
      notes,
      history,
      stats,
      settings: current.settings,
    },
    summary,
  }
}

export function recentActivityLabel(days: ReadingStats['days'], language: 'en' | 'id'): string {
  const keys = Object.keys(days).sort()
  if (!keys.length) return language === 'id' ? 'Belum ada aktivitas' : 'No activity yet'
  const latest = keys[keys.length - 1]
  return latest === dayKey()
    ? language === 'id'
      ? 'Aktif hari ini'
      : 'Active today'
    : latest
}
