import {
  BarChart3,
  Bookmark,
  BookOpen,
  FileText,
  FolderKanban,
  History,
  Home,
  Images,
  Layers,
  LayoutGrid,
  LibraryBig,
  NotebookPen,
  ScrollText,
  Settings,
  Star,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppState, useI18n } from '../../hooks/useAppStore'
import { categoryOf } from '../../utils/format'
import { Brand } from './Brand'

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

export function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const { t } = useI18n()
  const { documents } = useAppState()

  const counts = {
    all: documents.length,
    pdf: documents.filter((doc) => categoryOf(doc.format) === 'pdf').length,
    epub: documents.filter((doc) => categoryOf(doc.format) === 'epub').length,
    comics: documents.filter((doc) => categoryOf(doc.format) === 'comic').length,
    text: documents.filter((doc) => categoryOf(doc.format) === 'text').length,
    images: documents.filter((doc) => categoryOf(doc.format) === 'image').length,
    favorites: documents.filter((doc) => doc.favorite).length,
    reading: documents.filter((doc) => doc.progress > 0 && doc.progress < 0.995).length,
  }

  const mainLinks = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/library', label: t('nav.allDocuments'), icon: LibraryBig, count: counts.all },
    { to: '/pdf', label: t('nav.pdf'), icon: FileText, count: counts.pdf },
    { to: '/epub', label: t('nav.epub'), icon: BookOpen, count: counts.epub },
    { to: '/comics', label: t('nav.comics'), icon: LayoutGrid, count: counts.comics },
    { to: '/text', label: t('nav.textDocuments'), icon: ScrollText, count: counts.text },
    { to: '/images', label: t('nav.imageCollections'), icon: Images, count: counts.images },
  ]

  const organizeLinks = [
    { to: '/collections', label: t('nav.collections'), icon: FolderKanban },
    { to: '/series', label: t('nav.series'), icon: Layers },
    { to: '/bookmarks', label: t('nav.bookmarks'), icon: Bookmark },
    { to: '/notes', label: t('nav.notes'), icon: NotebookPen },
  ]

  const activityLinks = [
    { to: '/history', label: t('nav.history'), icon: History, count: counts.reading || undefined },
    { to: '/favorites', label: t('nav.favorites'), icon: Star, count: counts.favorites || undefined },
    { to: '/statistics', label: t('nav.statistics'), icon: BarChart3 },
  ]

  const renderLink = (link: {
    to: string
    label: string
    icon: typeof Home
    count?: number
    end?: boolean
  }) => {
    const Icon = link.icon
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        onClick={onNavigate}
      >
        <Icon size={18} strokeWidth={1.8} />
        <span>{link.label}</span>
        {link.count !== undefined && <em>{link.count}</em>}
      </NavLink>
    )
  }

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-top">
        <Brand />
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section">
          <span className="sidebar-label">{t('nav.library')}</span>
          {mainLinks.map(renderLink)}
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">{t('nav.organize')}</span>
          {organizeLinks.map(renderLink)}
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">{t('nav.activity')}</span>
          {activityLinks.map(renderLink)}
        </div>
      </nav>
      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Settings size={18} strokeWidth={1.8} />
          <span>{t('nav.settings')}</span>
        </NavLink>
        <div className="sidebar-storage">
          <span className="storage-pulse" />
          <div>
            <strong>{t('sidebar.storage')}</strong>
            <small>v1.0.0</small>
          </div>
        </div>
      </div>
    </aside>
  )
}
