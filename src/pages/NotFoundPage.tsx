import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useI18n } from '../hooks/useAppStore'
import { EmptyState } from '../components/common/UI'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="page">
      <EmptyState
        icon={<Compass size={32} />}
        title="404"
        text={t('common.error')}
        action={
          <Link className="button button-primary" to="/">
            {t('nav.home')}
          </Link>
        }
      />
    </div>
  )
}
