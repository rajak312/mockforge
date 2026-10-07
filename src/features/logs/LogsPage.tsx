import { Pause, Play, ScrollText, Search, Trash, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MethodBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { clockTime } from '@/lib/format'
import { REQUEST_ID_HEADER, tryFormatJson } from '@/lib/http'
import { useLogs, type LogEntry } from '@/store/logs'
import { useCollection } from '../shell/useCollection'

type Filter = 'all' | 'matched' | 'unmatched' | 'errors'

const OUTCOME_LABEL: Record<LogEntry['outcome'], string> = {
  matched: 'Matched',
  'no-route': 'No matching endpoint',
  'method-not-allowed': 'Method not allowed',
  'template-error': 'Template error',
  'resource-missing': 'Resource missing',
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers).filter(([k]) => k !== REQUEST_ID_HEADER)
  if (!entries.length) return <p className="text-xs text-subtle">None</p>
  return (
    <table className="w-full text-left text-[12px]">
      <tbody className="divide-y divide-line">
        {entries.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="w-2/5 py-1 pr-3 align-top font-mono font-medium text-muted">
              {k}
            </th>
            <td className="py-1 font-mono break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Body({ text, label }: { text: string; label: string }) {
  if (!text) return <p className="text-xs text-subtle">Empty</p>
  const formatted = tryFormatJson(text)
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <CodeEditor
        value={formatted.ok ? formatted.value : text}
        readOnly
        language={formatted.ok ? 'json' : 'text'}
        ariaLabel={label}
        lineNumbers={false}
        className="max-h-72 overflow-auto"
      />
    </div>
  )
}

function LogDetail({
  entry,
  onClose,
  collectionId,
}: {
  entry: LogEntry
  onClose: () => void
  collectionId: string
}) {
  return (
    <aside
      className="flex min-h-0 flex-col border-line bg-surface max-xl:border-t xl:w-[440px] xl:border-l"
      aria-label="Request details"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <MethodBadge method={entry.method} />
        <code className="min-w-0 flex-1 truncate text-[12.5px]">{entry.path}</code>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
          <dt className="text-muted">Status</dt>
          <dd>
            <StatusBadge status={entry.status} withText />
          </dd>
          <dt className="text-muted">Outcome</dt>
          <dd>{OUTCOME_LABEL[entry.outcome]}</dd>
          {entry.endpointLabel ? (
            <>
              <dt className="text-muted">Endpoint</dt>
              <dd className="min-w-0">
                {entry.collectionId === collectionId && entry.endpointId ? (
                  <Link
                    to={`/app/c/${collectionId}/e/${entry.endpointId}`}
                    className="font-mono text-accent hover:underline"
                  >
                    {entry.endpointLabel}
                  </Link>
                ) : (
                  <span className="font-mono">{entry.endpointLabel}</span>
                )}
                {entry.variantName ? (
                  <span className="text-muted"> → {entry.variantName}</span>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt className="text-muted">Latency</dt>
          <dd className="font-mono">{entry.durationMs} ms</dd>
          <dt className="text-muted">Time</dt>
          <dd>{new Date(entry.timestamp).toLocaleString()}</dd>
          {Object.keys(entry.params).length ? (
            <>
              <dt className="text-muted">Params</dt>
              <dd className="font-mono">
                {Object.entries(entry.params)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(', ')}
              </dd>
            </>
          ) : null}
        </dl>
        <section>
          <h3 className="label mb-1.5">Request headers</h3>
          <HeadersTable headers={entry.requestHeaders} />
        </section>
        {entry.requestBody ? (
          <section>
            <h3 className="label mb-1.5">Request body</h3>
            <Body text={entry.requestBody} label="Request body" />
          </section>
        ) : null}
        <section>
          <h3 className="label mb-1.5">Response headers</h3>
          <HeadersTable headers={entry.responseHeaders} />
        </section>
        <section>
          <h3 className="label mb-1.5">Response body</h3>
          <Body text={entry.responseBody} label="Response body" />
        </section>
      </div>
    </aside>
  )
}

export default function LogsPage() {
  const collection = useCollection()
  const { entries, paused, setPaused, clear, markSeen } = useLogs()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [allCollections, setAllCollections] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    markSeen()
  }, [entries.length, markSeen])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (!allCollections && e.collectionId !== collection.id) return false
      if (filter === 'matched' && e.outcome !== 'matched') return false
      if (filter === 'unmatched' && e.outcome === 'matched') return false
      if (filter === 'errors' && e.status < 400) return false
      if (
        q &&
        !`${e.method} ${e.path} ${e.endpointLabel ?? ''} ${e.variantName ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [entries, filter, query, allCollections, collection.id])

  const selected = entries.find((e) => e.id === selectedId)
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'matched', label: 'Matched' },
    { id: 'unmatched', label: 'Unmatched' },
    { id: 'errors', label: '4xx / 5xx' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by path or endpoint"
            aria-label="Filter requests"
            className="h-8 w-full rounded-lg border border-line bg-surface-2/50 pr-2 pl-8 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>
        <div
          className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5"
          role="group"
          aria-label="Filter by outcome"
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium',
                filter === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={allCollections}
            onChange={(e) => setAllCollections(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          All collections
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-subtle" aria-live="polite">
            {visible.length} requests
          </span>
          <Button
            size="sm"
            variant={paused ? 'primary' : 'outline'}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play /> : <Pause />} {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={!entries.length}>
            <Trash /> Clear
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 max-xl:flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          {visible.length === 0 ? (
            <EmptyState
              className="h-full"
              icon={ScrollText}
              title={entries.length ? 'No requests match the filters' : 'Waiting for requests'}
              description={
                entries.length ? (
                  'Try another filter or include all collections.'
                ) : (
                  <>
                    Every request intercepted by the mock worker shows up here live. Send one from
                    the API client, or open devtools and run{' '}
                    <code className="text-fg">fetch(&apos;{collection.baseUrl}/…&apos;)</code>.
                  </>
                )
              }
              action={
                entries.length ? undefined : (
                  <Link
                    to={`/app/c/${collection.id}/client`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Open the API client →
                  </Link>
                )
              }
            />
          ) : (
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="sticky top-0 z-10 border-b border-line bg-surface text-[11px] tracking-wide text-subtle uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Time
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Method
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Path
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Matched
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(entry.id)
                      }
                    }}
                    tabIndex={0}
                    aria-selected={entry.id === selectedId}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-surface-2/60 focus:bg-surface-2 focus:outline-none',
                      entry.id === selectedId && 'bg-accent-soft/50',
                    )}
                  >
                    <td className="px-4 py-2 font-mono text-[11.5px] whitespace-nowrap text-subtle">
                      {clockTime(entry.timestamp)}
                    </td>
                    <td className="px-2 py-2">
                      <MethodBadge method={entry.method} compact />
                    </td>
                    <td className="max-w-80 truncate px-2 py-2 font-mono">{entry.path}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="max-w-72 truncate px-2 py-2">
                      {entry.outcome === 'matched' ? (
                        <>
                          <span className="font-mono">{entry.endpointLabel}</span>
                          <span className="text-subtle"> → {entry.variantName}</span>
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          {OUTCOME_LABEL[entry.outcome]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                      {entry.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {selected ? (
          <LogDetail
            entry={selected}
            onClose={() => setSelectedId(null)}
            collectionId={collection.id}
          />
        ) : null}
      </div>
    </div>
  )
}
