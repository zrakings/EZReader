import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import { Modal } from './Modal'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface UIContextValue {
  toast: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const UIContext = createContext<UIContextValue | null>(null)

let toastCounter = 0

export function UIProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)
  const confirmResolver = useRef<((value: boolean) => void) | null>(null)

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastCounter
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, tone === 'error' ? 6000 : 4200)
  }, [])

  const closeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    if (confirmResolver.current) {
      confirmResolver.current(false)
      confirmResolver.current = null
    }
    setConfirmState(options)
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve
    })
  }, [])

  const finishConfirm = useCallback((value: boolean) => {
    confirmResolver.current?.(value)
    confirmResolver.current = null
    setConfirmState(null)
  }, [])

  useEffect(() => {
    const handleStorageError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      toast(detail || t('toast.storageError'), 'error')
    }
    window.addEventListener('ezreader:storage-error', handleStorageError)
    return () => window.removeEventListener('ezreader:storage-error', handleStorageError)
  }, [t, toast])

  useEffect(() => {
    const online = () => toast(t('toast.online'), 'success')
    const offline = () => toast(t('toast.offline'), 'warning')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [t, toast])

  const value = useMemo<UIContextValue>(() => ({ toast, confirm }), [toast, confirm])

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite">
        {toasts.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            <span className="toast-icon">
              {item.tone === 'success' ? (
                <CheckCircle2 size={18} />
              ) : item.tone === 'error' ? (
                <XCircle size={18} />
              ) : item.tone === 'warning' ? (
                <AlertTriangle size={18} />
              ) : (
                <Info size={18} />
              )}
            </span>
            <span>{item.message}</span>
            <button onClick={() => closeToast(item.id)} aria-label={t('common.close')}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal
          title={confirmState.title}
          onClose={() => finishConfirm(false)}
          size="small"
          closeLabel={t('common.close')}
          footer={
            <>
              <button type="button" className="button button-ghost" onClick={() => finishConfirm(false)}>
                {confirmState.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="button"
                className={`button ${confirmState.danger ? 'button-danger' : 'button-primary'}`}
                onClick={() => finishConfirm(true)}
              >
                {confirmState.confirmLabel ?? t('common.confirm')}
              </button>
            </>
          }
        >
          <p className="confirm-description">{confirmState.description ?? t('dialog.areYouSure')}</p>
        </Modal>
      )}
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext)
  if (!context) throw new Error('useUI must be used inside UIProvider')
  return context
}
