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

const container = document.getElementById('root')
if (!container) throw new Error('EZReader could not find its root element.')

createRoot(container).render(
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
