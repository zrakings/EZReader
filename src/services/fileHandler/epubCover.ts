import JSZip from 'jszip'
import { imageBlobToCover } from '../../utils/cover'
import { extensionOf } from '../../utils/format'

function cleanPath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0]
  try {
    return decodeURIComponent(withoutQuery)
  } catch {
    return withoutQuery
  }
}

function resolveZipPath(baseFilePath: string, href: string): string {
  const baseParts = cleanPath(baseFilePath).split('/')
  baseParts.pop()
  const hrefParts = cleanPath(href).split('/')
  for (const part of hrefParts) {
    if (!part || part === '.') continue
    if (part === '..') baseParts.pop()
    else baseParts.push(part)
  }
  return baseParts.join('/')
}

function findZipFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  return (
    zip.file(path) ??
    zip.file(cleanPath(path)) ??
    Object.values(zip.files).find((entry) => cleanPath(entry.name) === cleanPath(path) && !entry.dir) ??
    null
  )
}

export async function epubCover(file: File): Promise<string | null> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    return null
  }

  const containerEntry = findZipFile(zip, 'META-INF/container.xml')
  if (!containerEntry) return null
  const containerXml = await containerEntry.async('string')
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const rootfile = containerDoc.querySelector('rootfile')
  const opfPath = rootfile?.getAttribute('full-path')
  if (!opfPath) return null

  const opfEntry = findZipFile(zip, opfPath)
  if (!opfEntry) return null
  const opfXml = await opfEntry.async('string')
  const opf = new DOMParser().parseFromString(opfXml, 'application/xml')

  const manifestItems = Array.from(opf.querySelectorAll('manifest > item'))
  const metaCoverId = Array.from(opf.querySelectorAll('metadata > meta'))
    .find((meta) => meta.getAttribute('name')?.toLowerCase() === 'cover')
    ?.getAttribute('content')

  let coverHref: string | null = null
  let coverMediaType = ''
  const coverById = manifestItems.find((item) => item.getAttribute('id') === metaCoverId)
  const coverByProperty = manifestItems.find((item) =>
    (item.getAttribute('properties') ?? '').split(/\s+/).includes('cover-image'),
  )
  const coverGuide = opf.querySelector('guide > reference[type="cover"]')
  const chosen =
    coverById ??
    coverByProperty ??
    (coverGuide ? manifestItems.find((item) => item.getAttribute('href') === coverGuide.getAttribute('href')) : undefined)
  if (chosen) {
    coverHref = chosen.getAttribute('href')
    coverMediaType = chosen.getAttribute('media-type') ?? ''
  }

  if (!coverHref) {
    // Last-resort heuristic: an image next to the OPF named cover.*
    const candidates = Object.keys(zip.files).filter((name) => /(^|\/)cover\.(jpe?g|png|webp|gif)$/i.test(name))
    if (candidates.length) coverHref = candidates[0]
  }
  if (!coverHref) return null

  const resolved = resolveZipPath(opfPath, coverHref)
  const imageEntry = findZipFile(zip, resolved)
  if (!imageEntry) return null
  const blob = await imageEntry.async('blob')
  if (!blob.size) return null
  const isSvg =
    coverMediaType.includes('svg') || extensionOf(coverHref) === 'svg' || blob.type.includes('svg')
  if (isSvg) {
    // Some EPUB covers are SVG wrappers. Creating an image bitmap still works
    // in modern browsers if the SVG has explicit dimensions.
    const typed = new Blob([blob], { type: 'image/svg+xml' })
    return imageBlobToCover(typed)
  }
  return imageBlobToCover(blob)
}
