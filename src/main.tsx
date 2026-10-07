import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { hydrateResourceStore } from './mocks/runtime'
import { initTheme } from './store/theme'
import { startWorkspacePersistence, useWorkspace } from './store/workspace'
import './index.css'

initTheme()

async function bootstrap() {
  try {
    await Promise.all([useWorkspace.getState().hydrate(), hydrateResourceStore()])
  } catch (error) {
    console.error('[mockforge] could not open IndexedDB, continuing in memory', error)
    useWorkspace.setState({ ready: true })
  }
  startWorkspacePersistence()
  // Loaded lazily so MSW (and faker) stay off the critical rendering path.
  const { startMockWorker } = await import('./mocks/worker')
  await startMockWorker()
}

void bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
