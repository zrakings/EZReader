import { useEffect } from 'react'
import { store } from '../services/storage/store'

const IDLE_MS = 2 * 60 * 1000
const TICK_MS = 10_000

/**
 * Counts only active reading time:
 * - the tab must be visible
 * - the user must have interacted in the last two minutes
 * - the reader must be mounted
 */
export function useReadingTimer(active = true): void {
  useEffect(() => {
    if (!active) return
    let lastActivity = Date.now()
    let lastTick = Date.now()

    const markActivity = () => {
      lastActivity = Date.now()
    }

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    events.forEach((eventName) => {
      document.addEventListener(eventName, markActivity, { passive: true })
    })

    const tick = () => {
      const now = Date.now()
      const elapsed = now - lastTick
      lastTick = now
      if (document.visibilityState !== 'visible') return
      if (now - lastActivity > IDLE_MS) return
      const seconds = Math.min(15, Math.round(elapsed / 1000))
      if (seconds > 0) store.recordReadingTime(seconds)
    }

    const interval = window.setInterval(tick, TICK_MS)

    return () => {
      window.clearInterval(interval)
      events.forEach((eventName) => document.removeEventListener(eventName, markActivity))
      if (document.visibilityState === 'visible' && Date.now() - lastActivity <= IDLE_MS) {
        const seconds = Math.min(15, Math.round((Date.now() - lastTick) / 1000))
        if (seconds >= 3) store.recordReadingTime(seconds)
      }
    }
  }, [active])
}
