import type { DocumentFormat } from '../../types'
import { imageBlobToCover, placeholderCover } from '../../utils/cover'
import { openComicArchive, openImageSource } from '../archiveHandler/archive'
import { epubCover } from './epubCover'
import type { FileInspection } from './inspect'
import { pdfCover, pdfPageCount } from './pdf'

export interface CoverResult {
  cover: string
  totalPages: number
}

export async function createCoverForFile(
  file: File,
  inspection: FileInspection,
  title: string,
): Promise<CoverResult> {
  let totalPages = inspection.pageCount
  let cover: string | null = null

  try {
    if (inspection.format === 'pdf') {
      const [pdfCoverData, pages] = await Promise.all([pdfCover(file), pdfPageCount(file)])
      cover = pdfCoverData
      totalPages = pages
    } else if (inspection.format === 'epub') {
      cover = await epubCover(file)
    } else if (inspection.format === 'image') {
      cover = await imageBlobToCover(file)
      totalPages = 1
    } else if (
      inspection.format === 'cbz' ||
      inspection.format === 'cbr' ||
      inspection.format === 'cb7' ||
      inspection.format === 'cbt' ||
      inspection.format === 'zip'
    ) {
      const source = await openComicArchive(file, inspection.format as DocumentFormat)
      try {
        totalPages = source.count
        if (source.count > 0) {
          const blob = await source.getBlob(0)
          cover = await imageBlobToCover(blob)
        }
      } finally {
        source.dispose()
      }
    } else if (inspection.format === 'txt' || inspection.format === 'docx' || inspection.format === 'rtf') {
      totalPages = 0
    }
  } catch (error) {
    console.warn('EZReader could not extract a cover for', file.name, error)
  }

  return {
    cover: cover ?? placeholderCover(title, inspection.format),
    totalPages,
  }
}

export async function coverForSingleImage(file: File): Promise<string> {
  return (await imageBlobToCover(file)) ?? placeholderCover(file.name, 'image')
}

export { openImageSource }
