import type { DocumentMeta, FileEntry } from '../../types'
import { fileRegistry } from './store'

/**
 * Browser-local file copies are kept in the Cache API, not LocalStorage,
 * IndexedDB, or any remote service. Cache entries use a stable file identity
 * (name + size + last modified) instead of the document id, so backup restores
 * can remap ids without making a saved file unreadable.
 */
export const FILE_CACHE_NAME = 'ezreader-files-v1'

const FILE_PATH_PREFIX = 'ezreader-files/'
const HEADER_NAME = 'X-EZReader-File-Name'
const HEADER_SIZE = 'X-EZReader-Size'
const HEADER_MODIFIED = 'X-EZReader-Last-Modified'

type FileMeta = Pick<DocumentMeta, 'fileName' | 'size' | 'lastModified'>

export interface StoredFilesInfo {
  count: number
  size: number
}

function canUseCache(): boolean {
  return typeof caches !== 'undefined'
}

function storageKey(meta: FileMeta): string {
  return `${meta.fileName.toLowerCase()}::${meta.size}::${meta.lastModified}`
}

function requestFor(key: string): Request {
  const base = new URL('./', window.location.href)
  const url = new URL(`${FILE_PATH_PREFIX}${encodeURIComponent(key)}`, base)
  return new Request(url.toString())
}

function keyFromRequest(request: Request): string {
  try {
    const path = new URL(request.url).pathname
    const encoded = path.slice(path.lastIndexOf('/') + 1)
    return decodeURIComponent(encoded)
  } catch {
    return ''
  }
}

async function openCache(): Promise<Cache | null> {
  if (!canUseCache()) return null
  try {
    return await caches.open(FILE_CACHE_NAME)
  } catch (error) {
    console.warn('EZReader could not open its local file cache.', error)
    return null
  }
}

/**
 * Save a copy of an imported or re-linked file. Duplicate files are stored once.
 */
export async function saveFile(doc: FileMeta, entry: FileEntry): Promise<boolean> {
  const cache = await openCache()
  if (!cache) return false

  const request = requestFor(storageKey(doc))
  try {
    if (await cache.match(request)) return true
    const headers = new Headers({
      [HEADER_NAME]: encodeURIComponent(entry.file.name || doc.fileName),
      [HEADER_SIZE]: String(entry.file.size || doc.size),
      [HEADER_MODIFIED]: String(entry.file.lastModified || doc.lastModified),
      'Content-Type': entry.file.type || 'application/octet-stream',
    })
    await cache.put(request, new Response(entry.file, { headers }))
    return true
  } catch (error) {
    console.warn(`EZReader could not save a local copy of “${doc.fileName}”.`, error)
    return false
  }
}

/**
 * Rebuild an in-memory File object from a previously saved browser copy.
 */
export async function readFile(doc: DocumentMeta): Promise<File | null> {
  const cache = await openCache()
  if (!cache) return null

  try {
    const response = await cache.match(requestFor(storageKey(doc)))
    if (!response || !response.ok) return null
    const blob = await response.blob()
    const rawName = response.headers.get(HEADER_NAME)
    let name = doc.fileName
    if (rawName) {
      try {
        name = decodeURIComponent(rawName)
      } catch {
        name = rawName
      }
    }
    const lastModified = Number(response.headers.get(HEADER_MODIFIED)) || doc.lastModified
    return new File([blob], name, {
      type: blob.type || doc.mimeType || 'application/octet-stream',
      lastModified,
    })
  } catch (error) {
    console.warn(`EZReader could not restore the saved copy of “${doc.fileName}”.`, error)
    return null
  }
}

/**
 * Populate the runtime registry before React renders so documents in the
 * library, favorites, and collections are immediately ready to open.
 */
export async function hydrateFiles(documents: DocumentMeta[]): Promise<number> {
  let restored = 0
  for (const doc of documents) {
    if (fileRegistry.has(doc.id)) continue
    try {
      const file = await readFile(doc)
      if (!file) continue
      fileRegistry.set(doc.id, { file })
      restored += 1
    } catch {
      // A single bad cache entry must not block the rest of the library.
    }
  }
  return restored
}

/**
 * Save files that are already open in this tab (used when storage is enabled).
 */
export async function saveOpenFiles(documents: DocumentMeta[]): Promise<number> {
  let saved = 0
  for (const doc of documents) {
    const entry = fileRegistry.get(doc.id)
    if (!entry) continue
    if (await saveFile(doc, entry)) saved += 1
  }
  return saved
}

/**
 * Delete saved copies for documents that were removed from the library.
 * Shared copies used by documents that remain in the library are preserved.
 */
export async function removeFilesForDocuments(
  removed: DocumentMeta[],
  remaining: DocumentMeta[],
): Promise<void> {
  const cache = await openCache()
  if (!cache || !removed.length) return
  const kept = new Set(remaining.map(storageKey))
  for (const doc of removed) {
    const key = storageKey(doc)
    if (kept.has(key)) continue
    try {
      await cache.delete(requestFor(key))
    } catch (error) {
      console.warn(`EZReader could not remove the saved copy of “${doc.fileName}”.`, error)
    }
  }
}

/**
 * Remove saved copies that do not belong to any current document.
 */
export async function pruneFiles(documents: DocumentMeta[]): Promise<void> {
  const cache = await openCache()
  if (!cache) return
  const kept = new Set(documents.map(storageKey))
  try {
    const requests = await cache.keys()
    for (const request of requests) {
      if (kept.has(keyFromRequest(request))) continue
      await cache.delete(request)
    }
  } catch (error) {
    console.warn('EZReader could not clean up its local file cache.', error)
  }
}

export async function clearFiles(): Promise<void> {
  if (!canUseCache()) return
  try {
    await caches.delete(FILE_CACHE_NAME)
  } catch (error) {
    console.warn('EZReader could not clear its saved file copies.', error)
  }
}

export async function storedFilesInfo(): Promise<StoredFilesInfo> {
  const cache = await openCache()
  if (!cache) return { count: 0, size: 0 }
  try {
    const requests = await cache.keys()
    let size = 0
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) size += Number(response.headers.get(HEADER_SIZE)) || 0
    }
    return { count: requests.length, size }
  } catch (error) {
    console.warn('EZReader could not read its saved file cache info.', error)
    return { count: 0, size: 0 }
  }
}
