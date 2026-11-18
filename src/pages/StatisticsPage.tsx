import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, BookOpen, CheckCircle2, Clock3, FileText, Flame } from 'lucide-react'
import { useAppState, useI18n } from '../hooks/useAppStore'
import {
  dayKey,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  categoryOf,
} from '../utils/format'
import { EmptyState, PageHeader, ProgressBar } from '../components/common/UI'

const DAYS_HISTORY = 14
const MONTHS_HISTORY = 6

export function StatisticsPage() {
  const { t, language } = useI18n()
  const state = useAppState()
  const documents = state.documents

  const days = useMemo(() => {
    const list = []
    for (let offset = DAYS_HISTORY - 1; offset >= 0; offset -= 1) {
      const date = new Date()
      date.setHours(12, 0, 0, 0)
      date.setDate(date.getDate() - offset)
      const key = dayKey(date)
      const entry = state.stats.days[key] ?? { seconds: 0, pages: 0 }
      list.push({
        key,
        date,
        seconds: entry.seconds,
        pages: entry.pages,
        label: new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
          weekday: 'short',
        }).format(date),
        fullLabel: formatDate(date.toISOString(), language),
      })
    }
    return list
  }, [state.stats.days, language])

  const months = useMemo(() => {
    const list = []
    const now = new Date()
    for (let offset = MONTHS_HISTORY - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      let seconds = 0
      let pages = 0
      for (const [key, entry] of Object.entries(state.stats.days)) {
        if (!key.startsWith(prefix)) continue
        seconds += entry.seconds
        pages += entry.pages
      }
      list.push({
        key: prefix,
        seconds,
        pages,
        label: new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
          month: 'short',
        }).format(date),
      })
    }
    return list
  }, [state.stats.days, language])

  const totalSeconds = Object.values(state.stats.days).reduce((sum, entry) => sum + entry.seconds, 0)
  const totalPages = Object.values(state.stats.days).reduce((sum, entry) => sum + entry.pages, 0)
  const activeDays = Object.values(state.stats.days).filter((entry) => entry.seconds > 0 || entry.pages > 0).length
  const completedDocs = documents.filter((doc) => doc.completedAt || doc.progress >= 0.995)
  const readingDocs = documents.filter((doc) => doc.progress > 0 && doc.progress < 0.995)
  const maxDaySeconds = Math.max(1, ...days.map((day) => day.seconds))
  const maxMonthSeconds = Math.max(1, ...months.map((month) => month.seconds))
  const thisMonthPrefix = new Date().toISOString().slice(0, 7)
  const thisMonthSeconds = Object.entries(state.stats.days)
    .filter(([key]) => key.startsWith(thisMonthPrefix))
    .reduce((sum, [, entry]) => sum + entry.seconds, 0)

  const formats = useMemo(() => {
    const groups = new Map<string, number>()
    for (const doc of documents) {
      const category = categoryOf(doc.format)
      groups.set(category, (groups.get(category) ?? 0) + 1)
    }
    return Array.from(groups.entries())
      .map(([category, count]) => ({
        category,
        count,
        percent: documents.length ? count / documents.length : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [documents])

  const hasActivity = activeDays > 0 || totalPages > 0

  return (
    <div className="page stats-page">
      <PageHeader
        eyebrow={t('nav.activity')}
        title={t('statistics.title')}
        subtitle={t('statistics.subtitle')}
      />

      <div className="stats-summary">
        <div className="stats-card">
          <span className="stats-icon"><FileText size={18} /></span>
          <strong>{documents.length}</strong>
          <span>{t('statistics.totalDocuments')}</span>
        </div>
        <div className="stats-card">
          <span className="stats-icon"><CheckCircle2 size={18} /></span>
          <strong>{completedDocs.length}</strong>
          <span>{t('statistics.completed')}</span>
        </div>
        <div className="stats-card">
          <span className="stats-icon"><BookOpen size={18} /></span>
          <strong>{readingDocs.length}</strong>
          <span>{t('statistics.reading')}</span>
        </div>
        <div className="stats-card">
          <span className="stats-icon"><BarChart3 size={18} /></span>
          <strong>{formatNumber(totalPages)}</strong>
          <span>{t('statistics.pagesRead')}</span>
        </div>
        <div className="stats-card">
          <span className="stats-icon"><Clock3 size={18} /></span>
          <strong>{formatDuration(totalSeconds)}</strong>
          <span>{t('statistics.readingTime')}</span>
        </div>
        <div className="stats-card">
          <span className="stats-icon"><Flame size={18} /></span>
          <strong>{activeDays}</strong>
          <span>{t('statistics.daysActive', { count: activeDays })}</span>
        </div>
      </div>

      {!hasActivity ? (
        <EmptyState
          icon={<BarChart3 size={30} />}
          title={t('statistics.noActivity')}
          text={t('statistics.disclaimer')}
          compact
        />
      ) : (
        <div className="stats-grid">
          <section className="stats-panel stats-panel-wide">
            <div className="stats-panel-head">
              <div>
                <h2>{t('statistics.daily')}</h2>
                <p>{t('statistics.daysActive', { count: activeDays })}</p>
              </div>
              <span className="stats-highlight">{formatDuration(thisMonthSeconds)} · {t('statistics.thisMonth')}</span>
            </div>
            <div className="chart-bars" role="img" aria-label={t('statistics.daily')}>
              {days.map((day) => (
                <div className="chart-bar-wrap" key={day.key} title={`${day.fullLabel}: ${formatDuration(day.seconds)} · ${day.pages} ${t('statistics.pagesRead')}`}>
                  <span className="chart-value">{day.seconds > 0 ? formatDuration(day.seconds) : ''}</span>
                  <div className="chart-bar-track">
                    <span
                      className={`chart-bar ${day.seconds > 0 ? 'has-value' : ''}`}
                      style={{ height: `${Math.max(day.seconds > 0 ? 6 : 1, (day.seconds / maxDaySeconds) * 100)}%` }}
                    />
                  </div>
                  <span className="chart-label">{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="stats-panel">
            <div className="stats-panel-head">
              <h2>{t('statistics.monthly')}</h2>
            </div>
            <div className="month-list">
              {months.map((month) => (
                <div className="month-row" key={month.key}>
                  <span>{month.label}</span>
                  <div className="month-bar">
                    <span style={{ width: `${Math.max(month.seconds > 0 ? 3 : 0, (month.seconds / maxMonthSeconds) * 100)}%` }} />
                  </div>
                  <strong>{formatDuration(month.seconds)}</strong>
                  <small>{month.pages} {t('common.pages')}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="stats-panel">
            <div className="stats-panel-head">
              <h2>{t('statistics.formats')}</h2>
            </div>
            <div className="format-breakdown">
              {formats.map((item) => (
                <div className="format-row" key={item.category}>
                  <div className="format-row-head">
                    <span>{t(`nav.${item.category === 'comic' ? 'comics' : item.category === 'text' ? 'textDocuments' : item.category === 'image' ? 'imageCollections' : item.category}`)}</span>
                    <span>{item.count} · {formatPercent(item.percent)}</span>
                  </div>
                  <ProgressBar value={item.percent} />
                </div>
              ))}
            </div>
          </section>

          <section className="stats-panel stats-panel-wide">
            <div className="stats-panel-head">
              <div>
                <h2>{t('statistics.completedHistory')}</h2>
                <p>{t('statistics.completedHistoryText')}</p>
              </div>
            </div>
            {completedDocs.length === 0 ? (
              <div className="inline-empty">{t('statistics.noCompleted')}</div>
            ) : (
              <div className="completed-list">
                {completedDocs
                  .slice()
                  .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
                  .map((doc) => (
                    <Link to={`/read/${doc.id}`} className="completed-row" key={doc.id}>
                      <CheckCircle2 size={17} />
                      <span>
                        <strong>{doc.title}</strong>
                        <small>
                          {doc.completedAt ? formatDate(doc.completedAt, language) : t('reader.completed')}
                          {doc.totalPages > 0 ? ` · ${doc.totalPages} ${t('common.pages')}` : ''}
                        </small>
                      </span>
                    </Link>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}

      <p className="stats-disclaimer">{t('statistics.disclaimer')}</p>
    </div>
  )
}
