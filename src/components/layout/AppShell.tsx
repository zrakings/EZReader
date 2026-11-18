import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { UploadCloud, X } from 'lucide-react'
import { useI18n } from '../../hooks/useAppStore'
import { useImportDocuments } from '../../hooks/useImportDocuments'
import { formatForExtension, isImageFile } from '../../utils/format'
import type { FileEntry } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'

function supportedFile(file: File): boolean {
  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : ''
  return Boolean(formatForExtension(extension)) || isImageFile(file.name)
}

export function AppShell() {
  const { t } = useI18n()
  const { importFiles, busy } = useImportDocuments()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    mainRef.current?.scrollTo?.({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

  useEffect(() => {
    let depth = 0
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      depth += 1
      dragDepth.current = depth
      setDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      depth = Math.max(0, depth - 1)
      dragDepth.current = depth
      if (depth === 0) setDragging(false)
    }
    const onDrop = async (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      depth = 0
      dragDepth.current = 0
      setDragging(false)
      const entries: FileEntry[] = Array.from(event.dataTransfer?.files ?? [])
        .filter(supportedFile)
        .map((file) => ({ file }))
      if (entries.length) await importFiles(entries)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importFiles])

  return (
    <div className="app-shell">
      <Sidebar className="sidebar-desktop" />
      <div className="app-frame">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="app-main" ref={mainRef}>
          <Outlet />
        </main>
      </div>
      <MobileNav onOpenMenu={() => setDrawerOpen(true)} />

      {drawerOpen && (
        <div className="drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <div className="drawer-panel" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="icon-button drawer-close"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('common.close')}
            >
              <X size={19} />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <UploadCloud size={44} />
            <h2>{t('library.dropTitle')}</h2>
            <p>{t('library.dropText')}</p>
            {busy && <small>{t('import.processing', { current: 0, total: 0 })}</small>}
          </div>
        </div>
      )}
    </div>
  )
}
