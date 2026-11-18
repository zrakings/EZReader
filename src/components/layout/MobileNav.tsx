import { FolderKanban, Home, LayoutGrid, Menu, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../hooks/useAppStore'

export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useI18n()
  const links = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/library', label: t('nav.library'), icon: LayoutGrid },
    { to: '/collections', label: t('nav.collections'), icon: FolderKanban },
    { to: '/favorites', label: t('nav.favorites'), icon: Star },
  ]
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{link.label}</span>
          </NavLink>
        )
      })}
      <button type="button" className="mobile-nav-link" onClick={onOpenMenu}>
        <Menu size={20} strokeWidth={1.8} />
        <span>{t('common.more')}</span>
      </button>
    </nav>
  )
}
