import JSZip from 'jszip'
import { Archive } from 'libarchive.js'
import type { DocumentFormat } from '../../types'
import { extensionOf, isArchiveImageName } from '../../utils/format'
import { naturalCompare } from '../../utils/sort'

export interface PageSource {
  count: number
  names: string[]
  getBlob(index: number): Promise<Blob>
  getObjectURL(index: number): Promise<string>
  dispose(): void
}

let archiveInitialized = false

function ensureArchiveInitialized() {
  if (archiveInitialized) return
  const workerUrl = new URL('libarchive/worker-bundle.js', document.baseURI).href
  Archive.init({ workerUrl })
  archiveInitialized = true
}

function shouldIgnoreEntry(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  if (normalized.startsWith('__MACOSX/') || normalized.includes('/__MACOSX/')) return true
  const name = normalized.split('/').pop() ?? normalized
  if (name.startsWith('.')) return true
  if (name.toLowerCase() === 'thumbs.db') return true
  return false
}

function imageEntryNames(paths: string[]): string[] {
  return paths.filter((path) => !shouldIgnoreEntry(path) && isArchiveImageName(path)).sort(naturalCompare)
}

class ZipPageSource implements PageSource {
  readonly count: number
  readonly names: string[]
  private urls = new Map<number, string>()
  private disposed = false
  private zip: JSZip | null
  private entries: JSZip.JSZipObject[]

  constructor(zip: JSZip, entries: JSZip.JSZipObject[]) {
    this.zip = zip
    this.entries = entries
    this.names = entries.map((entry) => entry.name)
    this.count = entries.length
  }

  private ensureActive() {
    if (this.disposed || !this.zip) throw new Error('This archive has been closed.')
  }

  async getBlob(index: number): Promise<Blob> {
    this.ensureActive()
    const entry = this.entries[index]
    if (!entry) throw new Error('Image page not found.')
    return entry.async('blob')
  }

  async getObjectURL(index: number): Promise<string> {
    this.ensureActive()
    const cached = this.urls.get(index)
    if (cached) return cached
    const blob = await this.getBlob(index)
    this.ensureActive()
    const url = URL.createObjectURL(blob)
    this.urls.set(index, url)
    return url
  }

  dispose() {
    this.disposed = true
    this.urls.forEach((url) => URL.revokeObjectURL(url))
    this.urls.clear()
    this.entries = []
    this.zip = null
  }
}

class LibarchivePageSource implements PageSource {
  readonly count: number
  readonly names: string[]
  private urls = new Map<number, string>()
  private disposed = false
  private archive: any
  private entries: Array<{ path: string; extract: () => Promise<File> }>

  constructor(archive: any, entries: Array<{ path: string; extract: () => Promise<File> }>) {
    this.archive = archive
    this.entries = entries
    this.names = entries.map((entry) => entry.path)
    this.count = entries.length
  }

  async getBlob(index: number): Promise<Blob> {
    if (this.disposed) throw new Error('This archive has been closed.')
    const entry = this.entries[index]
    if (!entry) throw new Error('Image page not found.')
    return entry.extract()
  }

  async getObjectURL(index: number): Promise<string> {
    if (this.disposed) throw new Error('This archive has been closed.')
    const cached = this.urls.get(index)
    if (cached) return cached
    const blob = await this.getBlob(index)
    if (this.disposed) throw new Error('This archive has been closed.')
    const url = URL.createObjectURL(blob)
    this.urls.set(index, url)
    return url
  }

  dispose() {
    this.disposed = true
    this.urls.forEach((url) => URL.revokeObjectURL(url))
    this.urls.clear()
    this.entries = []
    try {
      this.archive?.close?.()
    } catch {
      // Worker may already be gone.
    }
    this.archive = null
  }
}

export class SingleImagePageSource implements PageSource {
  readonly count = 1
  readonly names: string[]
  private url: string | null = null
  private disposed = false

  constructor(private file: File) {
    this.names = [file.name]
  }

  async getBlob(): Promise<Blob> {
    if (this.disposed) throw new Error('This file has been closed.')
    return this.file
  }

  async getObjectURL(): Promise<string> {
    if (this.disposed) throw new Error('This file has been closed.')
    if (!this.url) this.url = URL.createObjectURL(this.file)
    return this.url
  }

  dispose() {
    this.disposed = true
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }
}

async function openZipPageSource(file: File): Promise<PageSource> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('The ZIP archive is damaged or unsupported.')
  }
  const names = imageEntryNames(Object.keys(zip.files))
  if (!names.length) throw new Error('This archive contains no readable images.')
  const entries = names.map((name) => zip.file(name)).filter((entry): entry is JSZip.JSZipObject => Boolean(entry))
  return new ZipPageSource(zip, entries)
}

async function openLibarchivePageSource(file: File): Promise<PageSource> {
  ensureArchiveInitialized()
  let archive: any
  try {
    archive = await Archive.open(file)
    const encrypted = await archive.hasEncryptedData()
    if (encrypted) {
      try {
        archive.close()
      } catch {
        // Ignore close errors on an encrypted archive.
      }
      throw new Error('Password-protected archives are not supported yet.')
    }
    const rawEntries: any[] = await archive.getFilesArray()
    const candidates = rawEntries
      .map((entry) => {
        const name = String(entry.file?.name ?? entry.file?._name ?? '')
        const directory = String(entry.path ?? entry.pathname ?? '')
        const path = `${directory}${name}`
        return {
          path,
          extract: () => entry.file.extract() as Promise<File>,
        }
      })
      .filter(
        (entry) => entry.path && !shouldIgnoreEntry(entry.path) && isArchiveImageName(entry.path),
      )
      .sort((a, b) => naturalCompare(a.path, b.path))
    if (!candidates.length) {
      try {
        archive.close()
      } catch {
        // Ignore.
      }
      throw new Error('This archive contains no readable images.')
    }
    return new LibarchivePageSource(archive, candidates)
  } catch (error) {
    try {
      archive?.close?.()
    } catch {
      // Ignore.
    }
    throw error
  }
}

export async function openComicArchive(
  file: File,
  format: DocumentFormat | string,
): Promise<PageSource> {
  const normalized = format.toLowerCase()
  if (normalized === 'zip' || normalized === 'cbz') {
    return openZipPageSource(file)
  }
  if (normalized === 'cbr' || normalized === 'cb7' || normalized === 'cbt') {
    return openLibarchivePageSource(file)
  }
  throw new Error('This format is not a supported comic archive.')
}

export async function openImageSource(file: File): Promise<PageSource> {
  return new SingleImagePageSource(file)
}

export function imageEntriesInZip(zip: JSZip): string[] {
  return imageEntryNames(Object.keys(zip.files))
}

export function archiveExtension(path: string): string {
  return extensionOf(path)
}
