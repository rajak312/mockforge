import { RotateCcw, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { tryFormatJson } from '@/lib/http'
import { useDemo } from '@/store/demo'
import { useWorkerStatus } from '@/store/worker-status'
import { makeTemplateLinter } from '../endpoints/template-tools'

interface DemoResponse {
  status: number
  ms: number
  body: string
}

/**
 * A real round trip: the template on the left is served by the MSW worker for
 * `/api/demo/users/:id`, and the request on the right is a plain fetch().
 */
export function LiveDemo() {
  const { template, setTemplate, reset } = useDemo()
  const workerReady = useWorkerStatus((s) => s.status === 'ready' && s.controlled)
  const [id, setId] = useState('42')
  const [response, setResponse] = useState<DemoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const lint = useMemo(() => makeTemplateLinter(true, { params: { id: '1' } }), [])
  const sentOnce = useRef(false)

  const send = async () => {
    setLoading(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await fetch(`/api/demo/users/${encodeURIComponent(id || '1')}`, {
        cache: 'no-store',
      })
      const text = await res.text()
      const formatted = tryFormatJson(text)
      setResponse({
        status: res.status,
        ms: Math.round(performance.now() - started),
        body: formatted.ok ? formatted.value : text,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (workerReady && !sentOnce.current) {
      sentOnce.current = true
      void send()
    }
    // send() only depends on state that is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerReady])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-accent/10">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="ml-2 text-xs font-medium text-muted">
          Live demo — edit the template, then send
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle">
          <span
            className={`size-1.5 rounded-full ${workerReady ? 'bg-emerald-500' : 'bg-amber-400'}`}
          />
          {workerReady ? 'MSW worker active' : 'Starting worker…'}
        </span>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="flex min-w-0 flex-col border-line max-md:border-b md:border-r">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <span className="rounded bg-emerald-500/12 px-1.5 font-mono text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400">
              GET
            </span>
            <code className="truncate text-xs">/api/demo/users/:id</code>
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={reset}
              title="Reset template"
            >
              <RotateCcw /> Reset
            </Button>
          </div>
          <CodeEditor
            value={template}
            onChange={setTemplate}
            language="template"
            lint={lint}
            params={['id']}
            ariaLabel="Demo response template"
            className="h-80"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <form
            className="flex items-center gap-2 border-b border-line px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-lg border border-line bg-surface-2/50 font-mono text-xs focus-within:border-accent">
              <span className="pl-2.5 text-subtle">fetch(&apos;/api/demo/users/</span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                aria-label="User id"
                className="w-10 min-w-0 flex-1 bg-transparent text-accent outline-none"
              />
              <span className="pr-2.5 text-subtle">&apos;)</span>
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={!workerReady || loading}>
              <Send /> Send
            </Button>
          </form>
          <div
            className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted"
            aria-live="polite"
          >
            {response ? (
              <>
                <StatusBadge status={response.status} withText />
                <span>
                  <span className="font-mono text-fg">{response.ms}</span> ms
                </span>
                <span className="ml-auto text-subtle">served by your template</span>
              </>
            ) : error ? (
              <span className="text-rose-500">{error}</span>
            ) : (
              <span>{loading ? 'Sending…' : 'Waiting for the first request'}</span>
            )}
          </div>
          <CodeEditor
            value={response?.body ?? ''}
            readOnly
            ariaLabel="Demo response"
            className="h-[17.6rem]"
            placeholder="Response appears here"
          />
        </div>
      </div>
    </div>
  )
}
