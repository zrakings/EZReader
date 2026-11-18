import type { DocumentFormat } from '../types'
import { escapeHtml, FORMAT_LABELS, FORMAT_TONES } from './format'

const TITLE_LINE_LENGTH = 22

function splitTitle(title: string): string[] {
  const words = title.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) {
      line = word
    } else if (`${line} ${word}`.length <= TITLE_LINE_LENGTH) {
      line += ` ${word}`
    } else {
      lines.push(line)
      line = word
    }
    if (lines.length === 4) break
  }
  if (line && lines.length < 4) lines.push(line)
  return lines.length ? lines : ['Untitled']
}

/** A deterministic, offline-safe cover used for text documents and as a fallback. */
export function placeholderCover(title: string, format: DocumentFormat): string {
  const tone = FORMAT_TONES[format]
  const label = FORMAT_LABELS[format]
  const lines = splitTitle(title)
  const fontSize = lines.some((line) => line.length > 18) ? 25 : 29
  const text = lines
    .map(
      (line, index) =>
        `<tspan x="32" dy="${index === 0 ? 0 : fontSize + 10}">${escapeHtml(line)}</tspan>`,
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="500" viewBox="0 0 360 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#151b22"/>
        <stop offset="0.55" stop-color="#0e1319"/>
        <stop offset="1" stop-color="#1a2028"/>
      </linearGradient>
      <radialGradient id="glow" cx="85%" cy="0%" r="100%">
        <stop offset="0" stop-color="${tone}" stop-opacity="0.34"/>
        <stop offset="0.55" stop-color="${tone}" stop-opacity="0.08"/>
        <stop offset="1" stop-color="${tone}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="360" height="500" rx="4" fill="url(#bg)"/>
    <rect width="360" height="500" fill="url(#glow)"/>
    <path d="M0 410 C90 365 220 445 360 380 L360 500 L0 500Z" fill="${tone}" opacity="0.08"/>
    <circle cx="300" cy="82" r="55" fill="none" stroke="${tone}" stroke-opacity="0.22"/>
    <circle cx="300" cy="82" r="34" fill="none" stroke="${tone}" stroke-opacity="0.14"/>
    <rect x="32" y="78" width="44" height="4" rx="2" fill="${tone}" opacity="0.9"/>
    <text x="32" y="112" fill="${tone}" font-family="Inter, Segoe UI, sans-serif" font-size="12" font-weight="700" letter-spacing="2.4">${label}</text>
    <text x="32" y="205" fill="#f1f4f6" font-family="Georgia, serif" font-size="${fontSize}" font-weight="600">${text}</text>
    <text x="32" y="458" fill="#82909c" font-family="Inter, Segoe UI, sans-serif" font-size="11" font-weight="600" letter-spacing="2.4">EZREADER</text>
    <text x="328" y="458" text-anchor="end" fill="${tone}" opacity="0.7" font-family="Inter, Segoe UI, sans-serif" font-size="10" letter-spacing="1">PERSONAL LIBRARY</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function canvasToCover(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.74)
}

/** Creates a small cover from an arbitrary image without keeping the original blob. */
export async function imageBlobToCover(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    try {
      const maxWidth = 360
      const maxHeight = 500
      const ratio = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height)
      const drawWidth = Math.max(1, Math.round(bitmap.width * ratio))
      const drawHeight = Math.max(1, Math.round(bitmap.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = drawWidth
      canvas.height = drawHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#10151b'
      ctx.fillRect(0, 0, drawWidth, drawHeight)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight)
      return canvasToCover(canvas)
    } finally {
      bitmap.close()
    }
  } catch {
    // Fall back to an <img> based thumbnail for browsers that cannot decode via ImageBitmap.
    return imageElementToCover(blob)
  }
}

function imageElementToCover(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      try {
        const maxWidth = 360
        const maxHeight = 500
        const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.fillStyle = '#10151b'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvasToCover(canvas))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

/** Utility used by custom collection / series cover uploads. */
export async function fileToCoverData(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  return imageBlobToCover(file)
}
