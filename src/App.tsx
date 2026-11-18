import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { useI18n, useTheme } from './hooks/useAppStore'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { SeriesPage } from './pages/SeriesPage'
import { SeriesDetailPage } from './pages/SeriesDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { BookmarksPage } from './pages/BookmarksPage'
import { NotesPage } from './pages/NotesPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { DocumentDetailPage } from './pages/DocumentDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ReaderHost } from './readers/ReaderHost'

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EZReader crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <ErrorFallback
        message={this.state.error.message}
        reset={() => {
          this.setState({ error: null })
          window.location.hash = '#/'
        }}
      />
    )
  }
}

function ErrorFallback({ message, reset }: { message: string; reset: () => void }) {
  const { t } = useI18n()
  return (
    <div className="fatal-error">
      <div className="fatal-error-card">
        <AlertTriangle size={34} />
        <h1>{t('common.error')}</h1>
        <p>{message}</p>
        <div className="fatal-error-actions">
          <button type="button" className="button button-primary" onClick={reset}>
            {t('nav.home')}
          </button>
          <button type="button" className="button button-ghost" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function App() {
  useTheme()
  return (
    <AppErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage scope="all" />} />
          <Route path="pdf" element={<LibraryPage scope="pdf" />} />
          <Route path="epub" element={<LibraryPage scope="epub" />} />
          <Route path="comics" element={<LibraryPage scope="comic" />} />
          <Route path="text" element={<LibraryPage scope="text" />} />
          <Route path="images" element={<LibraryPage scope="image" />} />
          <Route path="favorites" element={<LibraryPage scope="favorites" />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:id" element={<CollectionDetailPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="series/:id" element={<SeriesDetailPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="document/:id" element={<DocumentDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="read/:id" element={<ReaderHost />} />
      </Routes>
    </AppErrorBoundary>
  )
}
