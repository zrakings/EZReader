import { useEffect, useState, type FormEvent } from 'react'
import { Menu, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n, useAppSelector } from '../../hooks/useAppStore'
import { store } from '../../services/storage/store'
import { ImportButton } from '../documents/ImportButton'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const theme = useAppSelector((state) => state.settings.theme)
  const resolvedDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (location.pathname === '/library') setQuery(params.get('q') ?? '')
    else setQuery('')
  }, [location.pathname, location.search])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    navigate(trimmed ? `/library?q=${encodeURIComponent(trimmed)}` : '/library')
  }

  return (
    <header className="topbar">
      <button type="button" className="icon-button mobile-menu-button" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      <form className="topbar-search" onSubmit={submit} role="search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('topbar.searchPlaceholder')}
          aria-label={t('common.search')}
        />
        <kbd>↵</kbd>
      </form>
      <div className="topbar-actions">
        <span className={`network-chip ${online ? 'online' : 'offline'}`} title={online ? t('app.online') : t('app.offline')}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{online ? t('app.online') : t('app.offline')}</span>
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={resolvedDark ? t('reader.light') : t('reader.dark')}
          onClick={() => store.updateSettings({ theme: resolvedDark ? 'light' : 'dark' })}
        >
          {resolvedDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <ImportButton className="button button-primary topbar-import" />
      </div>
    </header>
  )
}
