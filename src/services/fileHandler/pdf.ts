import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const base = document.baseURI

export function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: new Uint8Array(data),
    cMapUrl: new URL('pdfjs/cmaps/', base).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', base).href,
    useWorkerFetch: true,
    isEvalSupported: false,
  }).promise
}

export async function pdfPageCount(file: File): Promise<number> {
  const data = await file.arrayBuffer()
  const pdf = await loadPdfDocument(data)
  try {
    return pdf.numPages
  } finally {
    await pdf.destroy()
  }
}

export async function pdfCover(file: File): Promise<string | null> {
  const data = await file.arrayBuffer()
  const pdf = await loadPdfDocument(data)
  try {
    if (!pdf.numPages) return null
    const page = await pdf.getPage(1)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(360 / baseViewport.width, 500 / baseViewport.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.76)
  } finally {
    await pdf.destroy()
  }
}
