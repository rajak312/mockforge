import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { RouteError } from './features/shell/RouteError'
import { useTheme } from './store/theme'
import { useWorkspace } from './store/workspace'

const LandingPage = lazy(() => import('./features/landing/LandingPage'))
const AppShell = lazy(() => import('./features/shell/AppShell'))
const CollectionLayout = lazy(() => import('./features/shell/CollectionLayout'))
const CollectionsPage = lazy(() => import('./features/collections/CollectionsPage'))
const EndpointsPage = lazy(() => import('./features/endpoints/EndpointsPage'))
const ResourcesPage = lazy(() => import('./features/resources/ResourcesPage'))
const ClientPage = lazy(() => import('./features/client/ClientPage'))
const LogsPage = lazy(() => import('./features/logs/LogsPage'))
const ExportPage = lazy(() => import('./features/export/ExportPage'))
const SharePage = lazy(() => import('./features/share/SharePage'))
const NotFound = lazy(() => import('./features/shell/NotFound'))

function AppIndex() {
  const { ready, activeCollectionId } = useWorkspace()
  if (!ready) return null
  return (
    <Navigate
      to={activeCollectionId ? `/app/c/${activeCollectionId}` : '/app/collections'}
      replace
    />
  )
}

function PageFallback() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-label="Loading">
      <div className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteError /> },
  { path: '/share', element: <SharePage />, errorElement: <RouteError /> },
  {
    path: '/app',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <AppIndex /> },
      { path: 'collections', element: <CollectionsPage /> },
      {
        path: 'c/:collectionId',
        element: <CollectionLayout />,
        children: [
          { index: true, element: <EndpointsPage /> },
          { path: 'e/:endpointId', element: <EndpointsPage /> },
          { path: 'resources', element: <ResourcesPage /> },
          { path: 'client', element: <ClientPage /> },
          { path: 'logs', element: <LogsPage /> },
          { path: 'export', element: <ExportPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])

export function App() {
  const theme = useTheme((s) => s.resolved)
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </>
  )
}
