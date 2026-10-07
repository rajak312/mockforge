import { TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonClass } from '@/components/ui/button-styles'

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'
  return (
    <main className="grid min-h-full place-items-center bg-bg p-6">
      <div className="panel max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm break-words text-muted">{message}</p>
        <p className="mt-1 text-xs text-subtle">
          Your collections are saved locally and were not affected.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className={buttonClass('secondary')} onClick={() => location.reload()}>
            Reload
          </button>
          <Link to="/app" className={buttonClass('primary')}>
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  )
}
