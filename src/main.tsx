import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/lora'
import { App } from './App'
import { UIProvider } from './components/common/UIProvider'
import { ImportProvider } from './hooks/useImportDocuments'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'
import './styles/reader.css'
import { registerServiceWorker } from './services/pwa'
import { hydrateFiles } from './services/storage/fileStore'
import { store } from './services/storage/store'

const container = document.getElementById('root')
if (!container) throw new Error('EZReader could not find its root element.')
const root: HTMLElement = container

async function start() {
  // Restore browser-local file copies before rendering so imported documents
  // are immediately available after a reload or a new browser session.
  try {
    await hydrateFiles(store.getState().documents)
  } catch (error) {
    console.warn('EZReader could not restore saved files.', error)
  }

  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <UIProvider>
          <ImportProvider>
            <App />
          </ImportProvider>
        </UIProvider>
      </HashRouter>
    </StrictMode>,
  )

  registerServiceWorker()
}

void start()
