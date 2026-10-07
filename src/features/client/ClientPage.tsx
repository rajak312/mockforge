import { ArrowRight, Clock, Send, Trash, TriangleAlert, WandSparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { KeyValueEditor } from '@/components/KeyValueEditor'
import { Kbd, MethodBadge, StatusBadge } from '@/components/ui/Badge'
import { methodTextColor } from '@/components/ui/badge-styles'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Tabs } from '@/components/ui/Tabs'
import { modKey, useHotkey } from '@/hooks/useHotkey'
import { toCurl } from '@/lib/codegen/curl'
import { cn } from '@/lib/cn'
import { db, type HistoryEntry } from '@/lib/db'
import { createKeyValue } from '@/lib/factory'
import { timeAgo } from '@/lib/format'
import {
  HEADER_SUGGESTIONS,
  formatBytes,
  methodHasBody,
  statusText,
  tryFormatJson,
} from '@/lib/http'
import { sampleUrl } from '@/lib/sample'
import { HTTP_METHODS, type HttpMethod, type KeyValue } from '@/lib/types'
import { emptyDraft, useClient, type ClientResponse, type RequestDraft } from '@/store/client'
import { useCollection } from '../shell/useCollection'
import { RequestError, saveHistory, sendRequest } from './send'

type RequestTab = 'params' | 'headers' | 'body'
type ResponseTab = 'body' | 'headers'

function paramsFromUrl(url: string): KeyValue[] {
  const index = url.indexOf('?')
  if (index === -1) return []
  return [...new URLSearchParams(url.slice(index + 1))].map(([key, value]) =>
    createKeyValue(key, value),
  )
}

function urlWithParams(url: string, params: KeyValue[]): string {
  const base = url.split('?')[0] ?? ''
  const search = new URLSearchParams(
    params.filter((p) => p.enabled && p.key).map((p) => [p.key, p.value]),
  ).toString()
  return search ? `${base}?${search}` : base
}

export default function ClientPage() {
  const collection = useCollection()
  // Remount per collection so local param state never leaks between collections.
  return <ClientView key={collection.id} />
}

function ClientView() {
  const collection = useCollection()
  const draft =
    useClient((s) => s.drafts[collection.id]) ??
    emptyDraft(
      collection.endpoints[0] ? sampleUrl(collection, collection.endpoints[0]) : collection.baseUrl,
    )
  const { response, error, loading, setDraft, set } = useClient()
  const [requestTab, setRequestTab] = useState<RequestTab>('params')
  const [params, setParams] = useState<KeyValue[]>(() => paramsFromUrl(draft.url))
  const history = useLiveQuery(
    () => db.history.where('collectionId').equals(collection.id).reverse().sortBy('timestamp'),
    [collection.id],
    [] as HistoryEntry[],
  )

  const update = (patch: Partial<RequestDraft>) => setDraft(collection.id, patch)

  const send = async () => {
    if (loading) return
    set({ loading: true, error: null })
    try {
      const result = await sendRequest(draft)
      set({ response: result, loading: false })
      await saveHistory({
        collectionId: collection.id,
        method: draft.method,
        url: draft.url,
        headers: draft.headers.map(({ key, value, enabled }) => ({ key, value, enabled })),
        body: draft.body,
        status: result.status,
        durationMs: result.durationMs,
        timestamp: Date.now(),
      })
    } catch (err) {
      set({
        loading: false,
        response: null,
        error: err instanceof RequestError ? err.message : String(err),
      })
    }
  }

  useHotkey('mod+enter', () => void send())

  const suggestions = useMemo(
    () =>
      collection.endpoints
        .filter((e) => e.enabled)
        .map((e) => ({ url: sampleUrl(collection, e), endpoint: e })),
    [collection],
  )

  const restore = (entry: HistoryEntry) => {
    setDraft(collection.id, {
      method: entry.method as HttpMethod,
      url: entry.url,
      headers: entry.headers.map((h) => ({
        ...createKeyValue(h.key, h.value),
        enabled: h.enabled,
      })),
      body: entry.body,
    })
    setParams(paramsFromUrl(entry.url))
  }

  const curl = () =>
    toCurl({
      method: draft.method,
      url: /^https?:/.test(draft.url) ? draft.url : location.origin + draft.url,
      headers: Object.fromEntries(
        draft.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value]),
      ),
      body: methodHasBody(draft.method) ? draft.body : '',
    })

  const hasBody = methodHasBody(draft.method)

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface lg:flex"
        aria-label="Request history"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Clock className="size-4 text-muted" />
          <h2 className="text-[13px] font-semibold">History</h2>
          {history.length ? (
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={async () => {
                await db.history.where('collectionId').equals(collection.id).delete()
              }}
            >
              <Trash /> Clear
            </Button>
          ) : null}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {history.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-subtle">
              Requests you send will show up here.
            </li>
          ) : (
            history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => restore(entry)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'w-12 shrink-0 font-mono text-[10.5px] font-bold',
                      methodTextColor[entry.method],
                    )}
                  >
                    {entry.method}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12px]">
                      {entry.url.replace(collection.baseUrl, '') || '/'}
                    </span>
                    <span className="block text-[10.5px] text-subtle">
                      {timeAgo(entry.timestamp)} · {entry.durationMs} ms
                    </span>
                  </span>
                  {entry.status ? <StatusBadge status={entry.status} /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3 sm:flex-nowrap"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <div className="flex h-10 min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <select
              value={draft.method}
              onChange={(e) => update({ method: e.target.value as HttpMethod })}
              aria-label="Request method"
              className={cn(
                'cursor-pointer border-r border-line bg-surface-2 px-2.5 font-mono text-xs font-bold outline-none',
                methodTextColor[draft.method],
              )}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              value={draft.url}
              onChange={(e) => {
                update({ url: e.target.value })
                setParams(paramsFromUrl(e.target.value))
              }}
              list="endpoint-urls"
              aria-label="Request URL"
              placeholder={`${collection.baseUrl}/…`}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none"
            />
            <datalist id="endpoint-urls">
              {suggestions.map(({ url, endpoint }) => (
                <option key={endpoint.id} value={url}>
                  {endpoint.method} {endpoint.name}
                </option>
              ))}
            </datalist>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="h-10"
            disabled={loading || !draft.url.trim()}
          >
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send />
            )}
            Send
            <span className="ml-1 hidden font-mono text-[11px] opacity-70 sm:inline">
              {modKey}↵
            </span>
          </Button>
        </form>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] 2xl:grid-cols-2 2xl:grid-rows-1">
          <section
            className="flex min-h-0 flex-col border-b border-line 2xl:border-r 2xl:border-b-0"
            aria-label="Request"
          >
            <div className="flex items-center px-4">
              <Tabs
                label="Request sections"
                value={requestTab}
                onChange={setRequestTab}
                className="flex-1 border-b-0"
                items={[
                  {
                    id: 'params',
                    label: 'Params',
                    badge: params.length ? (
                      <span className="text-[10.5px] text-subtle">{params.length}</span>
                    ) : undefined,
                  },
                  {
                    id: 'headers',
                    label: 'Headers',
                    badge: (
                      <span className="text-[10.5px] text-subtle">
                        {draft.headers.filter((h) => h.enabled && h.key).length}
                      </span>
                    ),
                  },
                  {
                    id: 'body',
                    label: 'Body',
                    badge:
                      hasBody && draft.body ? (
                        <span className="size-1.5 rounded-full bg-accent" />
                      ) : undefined,
                  },
                ]}
              />
              <CopyButton text={curl} label="cURL" toastLabel="Copied as cURL" />
            </div>
            <div className="max-h-[38vh] min-h-0 overflow-y-auto border-t border-line p-4 2xl:max-h-none 2xl:flex-1">
              {requestTab === 'params' ? (
                <KeyValueEditor
                  label="Query params"
                  items={params}
                  keyPlaceholder="param"
                  onChange={(next) => {
                    setParams(next)
                    update({ url: urlWithParams(draft.url, next) })
                  }}
                />
              ) : requestTab === 'headers' ? (
                <KeyValueEditor
                  label="Headers"
                  items={draft.headers}
                  onChange={(headers) => update({ headers })}
                  suggestions={HEADER_SUGGESTIONS}
                />
              ) : hasBody ? (
                <div className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center border-b border-line px-3 py-1.5 text-xs text-muted">
                    JSON body
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => {
                        const formatted = tryFormatJson(draft.body)
                        if (formatted.ok) update({ body: formatted.value })
                      }}
                    >
                      <WandSparkles /> Format
                    </Button>
                  </div>
                  <CodeEditor
                    value={draft.body}
                    onChange={(body) => update({ body })}
                    onSubmit={() => void send()}
                    ariaLabel="Request body"
                    className="h-56"
                    placeholder='{ "name": "Ada" }'
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                  {draft.method} requests don&apos;t send a body. Switch to POST, PUT or PATCH.
                </p>
              )}
            </div>
          </section>
          <ResponsePanel
            response={response}
            error={error}
            loading={loading}
            collectionId={collection.id}
            suggestions={suggestions}
            onPick={(url, method) => {
              update({ url, method })
              setParams(paramsFromUrl(url))
            }}
          />
        </div>
      </div>
    </div>
  )
}

function ResponsePanel({
  response,
  error,
  loading,
  collectionId,
  suggestions,
  onPick,
}: {
  response: ClientResponse | null
  error: string | null
  loading: boolean
  collectionId: string
  suggestions: {
    url: string
    endpoint: { id: string; method: HttpMethod; path: string; name: string }
  }[]
  onPick: (url: string, method: HttpMethod) => void
}) {
  const [tab, setTab] = useState<ResponseTab>('body')
  const collection = useCollection()
  const pretty = useMemo(() => {
    if (!response) return ''
    const formatted = tryFormatJson(response.body)
    return formatted.ok ? formatted.value : response.body
  }, [response])
  const isJson = !!response && tryFormatJson(response.body).ok
  const matched = response?.endpoint
    ? collection.endpoints.find((e) => `${e.method} ${e.path}` === response.endpoint)
    : undefined

  if (error) {
    return (
      <section className="grid place-items-center p-6" aria-label="Response" aria-live="polite">
        <div
          className="max-w-md rounded-xl border border-rose-500/30 bg-rose-500/8 p-5 text-sm text-rose-700 dark:text-rose-300"
          role="alert"
        >
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" /> Could not send request
          </p>
          <p className="mt-1.5">{error}</p>
        </div>
      </section>
    )
  }

  if (!response) {
    return (
      <section
        className="flex min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center"
        aria-label="Response"
        aria-live="polite"
      >
        {loading ? (
          <div
            className="size-6 animate-spin rounded-full border-2 border-line border-t-accent"
            role="status"
            aria-label="Sending"
          />
        ) : (
          <>
            <div>
              <p className="text-sm font-medium">Send a request to see the mocked response</p>
              <p className="mt-1 text-xs text-muted">
                Requests go through <code>fetch()</code> and are intercepted by the MSW service
                worker. Press <Kbd>{modKey}</Kbd> <Kbd>↵</Kbd> to send.
              </p>
            </div>
            {suggestions.length ? (
              <ul className="w-full max-w-md space-y-1 text-left">
                {suggestions.slice(0, 5).map(({ url, endpoint }) => (
                  <li key={endpoint.id}>
                    <button
                      type="button"
                      onClick={() => onPick(url, endpoint.method)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong"
                    >
                      <MethodBadge method={endpoint.method} compact />
                      <code className="truncate text-[12.5px]">{url}</code>
                      <ArrowRight className="ml-auto size-3.5 text-subtle" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>
    )
  }

  return (
    <section
      className={cn('flex min-h-0 flex-col', loading && 'opacity-60')}
      aria-label="Response"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <StatusBadge status={response.status} withText className="h-6 px-2 text-xs" />
        <span className="text-xs text-muted">
          <span className="font-mono text-fg">{response.durationMs}</span> ms
        </span>
        <span className="text-xs text-muted">{formatBytes(response.size)}</span>
        {response.endpoint ? (
          <Link
            to={matched ? `/app/c/${collectionId}/e/${matched.id}` : '#'}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg"
            title="Open the endpoint that served this response"
          >
            <span className="truncate font-mono">{response.endpoint}</span>
            {response.variant ? <span className="text-subtle">→ {response.variant}</span> : null}
          </Link>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400">Not served by a mock</span>
        )}
        <CopyButton text={response.body} label="Copy body" showLabel={false} className="ml-auto" />
      </div>
      <div className="px-4">
        <Tabs
          label="Response sections"
          value={tab}
          onChange={setTab}
          className="border-b-0"
          items={[
            { id: 'body', label: 'Body' },
            {
              id: 'headers',
              label: 'Headers',
              badge: <span className="text-[10.5px] text-subtle">{response.headers.length}</span>,
            },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t border-line">
        {tab === 'body' ? (
          response.body ? (
            <CodeEditor
              value={pretty}
              readOnly
              language={isJson ? 'json' : 'text'}
              ariaLabel="Response body"
              className="h-full"
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted">
              Empty body · {response.status} {statusText(response.status)}
            </p>
          )
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-line">
              {response.headers.map(([key, value]) => (
                <tr key={key}>
                  <th scope="row" className="w-1/3 px-4 py-1.5 font-mono font-medium text-muted">
                    {key}
                  </th>
                  <td className="px-4 py-1.5 font-mono break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
