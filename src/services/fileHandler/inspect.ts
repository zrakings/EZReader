import JSZip from 'jszip'
import type { DocumentFormat } from '../../types'
import {
  baseName,
  extensionOf,
  formatForExtension,
  isArchiveImageName,
  titleFromFileName,
} from '../../utils/format'

export interface FileInspection {
  format: DocumentFormat
  extension: string
  title: string
  mimeType: string
  pageCount: number
  warning?: string
}

function bytesToAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
}

function hasRarSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21 && bytes[4] === 0x1a && bytes[5] === 0x07
}

function has7zSignature(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x37 &&
    bytes[1] === 0x7a &&
    bytes[2] === 0xbc &&
    bytes[3] === 0xaf &&
    bytes[4] === 0x27 &&
    bytes[5] === 0x1c
  )
}

function hasImageSignature(bytes: Uint8Array, extension: string): boolean {
  if (extension === 'jpg' || extension === 'jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (extension === 'png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }
  if (extension === 'webp') {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  }
  return false
}

function hasTarHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 512) return false
  const magic = bytesToAscii(bytes.slice(257, 262))
  if (magic.startsWith('ustar')) return true
  // Older tar variants use a checksum rather than the ustar magic.
  const checksumField = bytesToAscii(bytes.slice(148, 156)).replace(/\0/g, '').trim()
  const stored = Number.parseInt(checksumField, 8)
  if (!Number.isFinite(stored)) return false
  let sum = 0
  for (let i = 0; i < 512; i += 1) {
    sum += i >= 148 && i < 156 ? 32 : bytes[i]
  }
  return sum === stored
}

async function readBytes(file: File, length: number): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer()
  return new Uint8Array(buffer)
}

function pageCountWarning(file: File): string | undefined {
  if (file.size > 250 * 1024 * 1024) {
    return 'This document is over 250 MB. Opening it may require a lot of memory on this device.'
  }
  return undefined
}

export async function inspectFile(file: File): Promise<FileInspection> {
  const extension = extensionOf(file.name)
  const format = formatForExtension(extension)
  if (!format) {
    throw new Error(`Unsupported file type${extension ? ` .${extension}` : ''}.`)
  }

  const head = await readBytes(file, 512)
  let pageCount = format === 'image' ? 1 : 0

  if (format === 'pdf') {
    if (bytesToAscii(head.slice(0, 5)) !== '%PDF-') {
      throw new Error('The file does not have a valid PDF signature.')
    }
  } else if (format === 'image') {
    if (!hasImageSignature(head, extension)) {
      throw new Error('The image file is damaged or does not match its extension.')
    }
  } else if (format === 'cbr') {
    if (!hasRarSignature(head)) throw new Error('The file is not a valid RAR archive.')
  } else if (format === 'cb7') {
    if (!has7zSignature(head)) throw new Error('The file is not a valid 7z archive.')
  } else if (format === 'cbt') {
    if (!hasTarHeader(head) && !hasTarHeader(await readBytes(file, 1024))) {
      // TAR is one of the few formats where a legacy header can be unusual.
      // Let libarchive make the final call for a .cbt file, but require the
      // file to at least be large enough to contain a header.
      if (file.size < 512) throw new Error('The file is not a valid TAR archive.')
    }
  } else if (format === 'rtf') {
    const text = await file.slice(0, 16).text()
    if (!/^\s*\{\\rtf/i.test(text)) {
      throw new Error('The file does not have a valid RTF header.')
    }
  } else if (format === 'txt') {
    const sample = await readBytes(file, 8192)
    let controlBytes = 0
    for (const byte of sample) {
      if (byte === 0) controlBytes += 1
    }
    if (sample.length && controlBytes / sample.length > 0.02) {
      throw new Error('This file looks like binary data, not plain text.')
    }
  } else if (format === 'epub' || format === 'docx' || format === 'cbz' || format === 'zip') {
    if (!hasZipSignature(head)) throw new Error('The file is not a valid ZIP archive.')
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(file)
    } catch {
      throw new Error('The ZIP archive could not be read. It may be damaged.')
    }
    if (format === 'epub') {
      if (!zip.file('META-INF/container.xml')) {
        throw new Error('This ZIP file is not a valid EPUB book.')
      }
    } else if (format === 'docx') {
      if (!zip.file('word/document.xml')) {
        throw new Error('This ZIP file is not a valid DOCX document.')
      }
    } else {
      const imageEntries = Object.values(zip.files).filter(
        (entry) => !entry.dir && isArchiveImageName(entry.name),
      )
      if (!imageEntries.length) {
        throw new Error('This archive contains no readable images.')
      }
      pageCount = imageEntries.length
    }
  }

  const mimeType =
    format === 'image'
      ? file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`
      : file.type || 'application/octet-stream'

  return {
    format,
    extension,
    title: titleFromFileName(baseName(file.name)),
    mimeType,
    pageCount,
    warning: pageCountWarning(file),
  }
}
