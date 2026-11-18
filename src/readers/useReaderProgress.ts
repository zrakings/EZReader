import { useCallback, useEffect, useRef } from 'react'
import { store } from '../services/storage/store'
import type { DocumentMeta, ReaderLocation } from '../types'

export function useReaderProgress(document: DocumentMeta) {
  const lastKey = useRef('')
  const pending = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const pendingValue = useRef<{ location: ReaderLocation; totalPages: number } | null>(null)

  const flush = useCallback(() => {
    if (!pendingValue.current) return
    const { location, totalPages } = pendingValue.current
    pendingValue.current = null
    store.updateProgress(document.id, {
      progress: location.percentage,
      lastPage: location.page ?? 0,
      totalPages,
      location,
    })
  }, [document.id])

  const report = useCallback(
    (location: ReaderLocation, totalPages: number, immediate = false) => {
      const key = `${location.type}:${location.value}:${totalPages}`
      if (key === lastKey.current && !immediate) return
      lastKey.current = key
      pendingValue.current = { location, totalPages }
      if (pending.current) window.clearTimeout(pending.current)
      if (immediate) {
        flush()
        return
      }
      pending.current = window.setTimeout(() => {
        pending.current = null
        flush()
      }, 450)
    },
    [flush],
  )

  useEffect(() => {
    return () => {
      if (pending.current) window.clearTimeout(pending.current)
      if (pendingValue.current) flush()
    }
  }, [flush])

  return report
}
