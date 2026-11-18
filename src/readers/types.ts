import type { DocumentMeta, ReaderLocation } from '../types'

export interface TocEntry {
  label: string
  location: ReaderLocation
  depth?: number
}

export interface ReaderProps {
  doc: DocumentMeta
  file: File
  initialLocation: ReaderLocation | null
  onClose: () => void
}
