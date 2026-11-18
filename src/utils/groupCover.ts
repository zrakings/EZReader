import type { Collection, DocumentMeta, Series } from '../types'
import { placeholderCover } from './cover'

export function resolveGroupCover(
  group: Collection | Series,
  documents: DocumentMeta[],
  covers: Record<string, string>,
): { src: string; format: DocumentMeta['format'] } {
  if (group.coverMode === 'custom' && group.coverData) {
    return { src: group.coverData, format: 'image' }
  }
  const chosen =
    (group.coverDocumentId ? documents.find((doc) => doc.id === group.coverDocumentId) : undefined) ??
    documents.find((doc) => covers[doc.id]) ??
    documents[0]
  if (chosen) {
    return {
      src: covers[chosen.id] ?? placeholderCover(chosen.title, chosen.format),
      format: chosen.format,
    }
  }
  return { src: placeholderCover(group.name, 'image'), format: 'image' }
}
