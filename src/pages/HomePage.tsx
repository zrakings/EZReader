import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileText,
  FolderKanban,
  Layers,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'
import { useAppState, useI18n, useIsFileAvailable } from '../hooks/useAppStore'
import type { DocumentMeta } from '../types'
import { formatDuration, formatPercent, relativeTime } from '../utils/format'
import { resolveGroupCover } from '../utils/groupCover'
import { Cover, FormatBadge } from '../components/common/Cover'
import { ImportButton } from '../components/documents/ImportButton'
import { EmptyState, ProgressBar, SectionHeader } from '../components/common/UI'

export function HomePage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const navigate = useNavigate()
  const documents = state.documents
  const continueDocs = documents
    .filter((doc) => doc.progress > 0 && doc.progress < 0.995)
    .sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    .slice(0, 6)
  const recentlyAdded = [...documents]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 6)
  const recentlyRead = [...documents]
    .filter((doc) => doc.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    .slice(0, 5)
  const favoriteDocs = documents.filter((doc) => doc.favorite)
  const favorites = favoriteDocs.slice(0, 4)
  const collections = state.collections.slice(0, 4)
  const activeDays = Object.keys(state.stats.days).length
  const pagesRead = Object.values(state.stats.days).reduce((sum, day) => sum + day.pages, 0)
  const seconds = Object.values(state.stats.days).reduce((sum, day) => sum + day.seconds, 0)
  const completed = documents.filter((doc) => doc.completedAt || doc.progress >= 0.995).length

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">
            <Sparkles size={14} />
            {t('dashboard.welcome')}
          </span>
          <h1>{t('dashboard.heroTitle')}</h1>
          <p>{t('dashboard.heroText')}</p>
          <div className="home-hero-actions">
            <ImportButton label={t('library.importDocuments')} />
            {continueDocs[0] ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => navigate(`/read/${continueDocs[0].id}`)}
              >
                <BookOpen size={16} />
                {t('dashboard.continueReading')}
              </button>
            ) : (
              <Link className="button button-ghost" to="/library">
                <BookOpen size={16} />
                {t('nav.allDocuments')}
              </Link>
            )}
          </div>
          <div className="home-hero-stats">
            <div>
              <strong>{documents.length}</strong>
              <span>{t('statistics.totalDocuments')}</span>
            </div>
            <div>
              <strong>{activeDays}</strong>
              <span>{t('statistics.daysActiveShort')}</span>
            </div>
            <div>
              <strong>{formatDuration(seconds)}</strong>
              <span>{t('statistics.readingTime')}</span>
            </div>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <div className="hero-shelf">
            {(recentlyAdded.length ? recentlyAdded : []).slice(0, 3).map((doc, index) => (
              <div className={`hero-book hero-book-${index + 1}`} key={doc.id}>
                <Cover
                  src={state.covers[doc.id]}
                  title={doc.title}
                  format={doc.format}
                  extension={doc.extension}
                  showFormat={false}
                />
              </div>
            ))}
            {!recentlyAdded.length && (
              <>
                <div className="hero-book hero-book-1 hero-book-empty" />
                <div className="hero-book hero-book-2 hero-book-empty" />
                <div className="hero-book hero-book-3 hero-book-empty" />
              </>
            )}
          </div>
          <div className="hero-glow" />
          <div className="hero-caption">
            <span className="storage-pulse" />
            {t('app.localOnly')}
          </div>
        </div>
      </section>

      {documents.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title={t('dashboard.emptyTitle')}
          text={t('dashboard.emptyText')}
          action={<ImportButton label={t('dashboard.importFirst')} />}
        />
      ) : (
        <>
          <section className="home-stats-strip">
            <Link to="/statistics" className="home-stat-card">
              <span className="home-stat-icon"><TrendingUp size={18} /></span>
              <div>
                <strong>{formatDuration(seconds)}</strong>
                <span>{t('statistics.readingTime')}</span>
              </div>
            </Link>
            <Link to="/statistics" className="home-stat-card">
              <span className="home-stat-icon"><FileText size={18} /></span>
              <div>
                <strong>{pagesRead}</strong>
                <span>{t('statistics.pagesRead')}</span>
              </div>
            </Link>
            <Link to="/statistics" className="home-stat-card">
              <span className="home-stat-icon"><Clock3 size={18} /></span>
              <div>
                <strong>{completed}</strong>
                <span>{t('statistics.completed')}</span>
              </div>
            </Link>
            <Link to="/statistics" className="home-stat-card">
              <span className="home-stat-icon"><Star size={18} /></span>
              <div>
                <strong>{favoriteDocs.length}</strong>
                <span>{t('dashboard.favorites')}</span>
              </div>
            </Link>
          </section>

          <section className="home-section">
            <SectionHeader
              title={t('dashboard.continueReading')}
              subtitle={
                continueDocs.length
                  ? t('dashboard.inProgress', { count: continueDocs.length })
                  : t('dashboard.noContinue')
              }
              action={
                <Link className="text-link" to="/history">
                  {t('dashboard.seeAll')} <ArrowRight size={14} />
                </Link>
              }
            />
            {continueDocs.length === 0 ? (
              <div className="inline-empty">{t('dashboard.noContinue')}</div>
            ) : (
              <div className="continue-strip">
                {continueDocs.map((doc) => (
                  <ContinueCard key={doc.id} document={doc} onOpen={() => navigate(`/read/${doc.id}`)} />
                ))}
              </div>
            )}
          </section>

          <section className="home-section">
            <SectionHeader
              title={t('dashboard.recentlyAdded')}
              action={
                <Link className="text-link" to="/library">
                  {t('dashboard.seeAll')} <ArrowRight size={14} />
                </Link>
              }
            />
            <div className="home-recent-grid">
              {recentlyAdded.map((doc) => (
                <PreviewCard key={doc.id} documentId={doc.id} onOpen={() => navigate(`/read/${doc.id}`)} />
              ))}
            </div>
          </section>

          <div className="home-two-column">
            <section className="home-section">
              <SectionHeader
                title={t('dashboard.recentlyRead')}
                action={
                  <Link className="text-link" to="/history">
                    {t('dashboard.seeAll')} <ArrowRight size={14} />
                  </Link>
                }
              />
              {recentlyRead.length === 0 ? (
                <div className="inline-empty">{t('dashboard.noRecent')}</div>
              ) : (
                <div className="recent-list">
                  {recentlyRead.map((doc) => (
                    <button
                      type="button"
                      className="recent-row"
                      key={doc.id}
                      onClick={() => navigate(`/read/${doc.id}`)}
                    >
                      <Cover
                        src={state.covers[doc.id]}
                        title={doc.title}
                        format={doc.format}
                        extension={doc.extension}
                        className="recent-cover"
                        showFormat={false}
                      />
                      <span className="recent-main">
                        <span className="recent-title">{doc.title}</span>
                        <span className="recent-meta">
                          <FormatBadge format={doc.format} extension={doc.extension} />
                          {doc.lastOpenedAt && (
                            <span>{relativeTime(doc.lastOpenedAt, language)}</span>
                          )}
                        </span>
                        {doc.progress > 0 && <ProgressBar value={doc.progress} />}
                      </span>
                      <span className="recent-percent">{formatPercent(doc.progress)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="home-section">
              <SectionHeader
                title={t('dashboard.myCollections')}
                action={
                  <Link className="text-link" to="/collections">
                    {t('dashboard.seeAll')} <ArrowRight size={14} />
                  </Link>
                }
              />
              {collections.length === 0 ? (
                <div className="inline-empty">
                  {t('dashboard.noCollections')}{' '}
                  <Link to="/collections" className="text-link">
                    {t('collections.create')}
                  </Link>
                </div>
              ) : (
                <div className="collection-preview-list">
                  {collections.map((collection) => {
                    const docs = collection.documentIds
                      .map((id) => documents.find((doc) => doc.id === id))
                      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
                    const cover = resolveGroupCover(collection, docs, state.covers)
                    return (
                      <Link
                        className="collection-preview-row"
                        key={collection.id}
                        to={`/collections/${collection.id}`}
                      >
                        <Cover
                          src={cover.src}
                          title={collection.name}
                          format={cover.format}
                          className="collection-preview-cover"
                          showFormat={false}
                        />
                        <span>
                          <strong>{collection.name}</strong>
                          <small>{t('collections.documents', { count: docs.length })}</small>
                        </span>
                        <FolderKanban size={16} />
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="home-section">
            <SectionHeader
              title={t('dashboard.favorites')}
              action={
                <Link className="text-link" to="/favorites">
                  {t('dashboard.seeAll')} <ArrowRight size={14} />
                </Link>
              }
            />
            {favorites.length === 0 ? (
              <div className="inline-empty">{t('dashboard.noFavorites')}</div>
            ) : (
              <div className="home-recent-grid">
                {favorites.map((doc) => (
                  <PreviewCard key={doc.id} documentId={doc.id} onOpen={() => navigate(`/read/${doc.id}`)} />
                ))}
              </div>
            )}
          </section>

          <section className="home-section">
            <SectionHeader
              title={t('nav.series')}
              action={
                <Link className="text-link" to="/series">
                  {t('dashboard.seeAll')} <ArrowRight size={14} />
                </Link>
              }
            />
            {state.series.length === 0 ? (
              <div className="inline-empty">
                <Layers size={15} /> {t('series.emptyText')}{' '}
                <Link to="/series" className="text-link">
                  {t('series.create')}
                </Link>
              </div>
            ) : (
              <div className="series-preview-grid">
                {state.series.slice(0, 4).map((series) => {
                  const docs = series.documentIds
                    .map((id) => documents.find((doc) => doc.id === id))
                    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
                  const cover = resolveGroupCover(series, docs, state.covers)
                  const complete = docs.filter((doc) => doc.completedAt || doc.progress >= 0.995).length
                  return (
                    <Link className="series-preview-card" key={series.id} to={`/series/${series.id}`}>
                      <Cover
                        src={cover.src}
                        title={series.name}
                        format={cover.format}
                        className="series-preview-cover"
                        showFormat={false}
                      />
                      <span>
                        <strong>{series.name}</strong>
                        <small>
                          {complete}/{docs.length} · {t('series.volumes', { count: docs.length })}
                        </small>
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ContinueCard({
  document,
  onOpen,
}: {
  document: DocumentMeta
  onOpen: () => void
}) {
  const { t } = useI18n()
  const state = useAppState()
  const available = useIsFileAvailable(document.id)
  return (
    <button type="button" className="continue-card" onClick={onOpen}>
      <Cover
        src={state.covers[document.id]}
        title={document.title}
        format={document.format}
        extension={document.extension}
        className="continue-cover"
        showFormat={false}
      />
      <span className="continue-copy">
        <FormatBadge format={document.format} extension={document.extension} />
        <strong>{document.title}</strong>
        <span className="continue-progress-label">{formatPercent(document.progress)}</span>
        <ProgressBar value={document.progress} />
        <span className="continue-footer">
          <span>{available ? t('card.continue') : t('card.locate')}</span>
          <ArrowRight size={15} />
        </span>
      </span>
    </button>
  )
}

function PreviewCard({ documentId, onOpen }: { documentId: string; onOpen: () => void }) {
  const { t } = useI18n()
  const state = useAppState()
  const document = state.documents.find((doc) => doc.id === documentId)
  const available = useIsFileAvailable(documentId)
  if (!document) return null
  return (
    <button type="button" className="preview-card" onClick={onOpen}>
      <Cover
        src={state.covers[document.id]}
        title={document.title}
        format={document.format}
        extension={document.extension}
        className="preview-cover"
        showFormat={false}
      />
      <span className="preview-info">
        <strong>{document.title}</strong>
        <span>{available ? formatPercent(document.progress) : t('library.needsFile')}</span>
      </span>
    </button>
  )
}
