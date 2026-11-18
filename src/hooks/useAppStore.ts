import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { fileRegistry, store } from '../services/storage/store'
import type { AppState } from '../types'
import { translate, type Translate } from '../utils/i18n'

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useAppSelector<T>(
  selector: (state: AppState) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  const state = useAppState()
  const value = selector(state)
  const valueRef = useRef(value)
  if (!equals(valueRef.current, value)) valueRef.current = value
  return valueRef.current
}

export function useFileVersion(): number {
  return useSyncExternalStore(fileRegistry.subscribe, fileRegistry.snapshot, fileRegistry.snapshot)
}

export function useIsFileAvailable(documentId: string): boolean {
  useFileVersion()
  return fileRegistry.has(documentId)
}

export function useI18n(): { t: Translate; language: 'en' | 'id' } {
  const language = useAppSelector((state) => state.settings.language)
  const t = useCallback<Translate>((key, vars) => translate(language, key, vars), [language])
  return { t, language }
}

export function useTheme(): void {
  const settings = useAppSelector((state) => state.settings)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.dataset.theme = resolved
      document.documentElement.dataset.accent = settings.accent
      document.documentElement.dataset.grid = settings.gridSize
      const themeColor = resolved === 'dark' ? '#0b0e12' : '#f5f3ee'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', themeColor)
    }
    apply()
    if (settings.theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [settings.theme, settings.accent, settings.gridSize])
}
