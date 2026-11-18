import type { DocumentMeta, SortKey } from '../types'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function naturalCompare(a: string, b: string): number {
  return naturalCollator.compare(a, b)
}

export function sortDocuments(documents: DocumentMeta[], sort: SortKey): DocumentMeta[] {
  const copy = [...documents]
  switch (sort) {
    case 'added-asc':
      return copy.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    case 'added-desc':
      return copy.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    case 'title-asc':
      return copy.sort((a, b) => collator.compare(a.title, b.title))
    case 'title-desc':
      return copy.sort((a, b) => collator.compare(b.title, a.title))
    case 'opened-desc':
      return copy.sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    case 'format-asc':
      return copy.sort((a, b) => collator.compare(a.format, b.format) || collator.compare(a.title, b.title))
    case 'progress-desc':
      return copy.sort((a, b) => b.progress - a.progress || collator.compare(a.title, b.title))
    default:
      return copy
  }
}

export const SORT_OPTIONS: Array<{ value: SortKey; labelKey: string }> = [
  { value: 'added-desc', labelKey: 'sort.addedDesc' },
  { value: 'added-asc', labelKey: 'sort.addedAsc' },
  { value: 'opened-desc', labelKey: 'sort.openedDesc' },
  { value: 'title-asc', labelKey: 'sort.titleAsc' },
  { value: 'title-desc', labelKey: 'sort.titleDesc' },
  { value: 'format-asc', labelKey: 'sort.formatAsc' },
  { value: 'progress-desc', labelKey: 'sort.progressDesc' },
]
