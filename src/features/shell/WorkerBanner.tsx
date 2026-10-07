import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useWorkerStatus } from '@/store/worker-status'

/** Explains why requests are not being mocked (hard reload, unsupported browser…). */
export function WorkerBanner() {
  const { status, message, controlled } = useWorkerStatus()
  const problem =
    status === 'ready' && !controlled
      ? 'This tab was hard-reloaded, so the mock service worker is not intercepting requests.'
      : status === 'unsupported' || status === 'error'
        ? message || 'The mock service worker could not start.'
        : null
  if (!problem) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] text-amber-800 dark:text-amber-300"
    >
      <TriangleAlert className="size-4 shrink-0" />
      <p className="flex-1">{problem}</p>
      {status === 'ready' ? (
        <Button size="xs" variant="outline" onClick={() => location.reload()}>
          Reload
        </Button>
      ) : null}
    </div>
  )
}
