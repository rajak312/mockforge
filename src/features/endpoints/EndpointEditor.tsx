import { ArrowLeft, Copy, Ellipsis, Play, Terminal, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { methodTextColor } from '@/components/ui/badge-styles'
import { Button } from '@/components/ui/Button'
import { copyText } from '@/lib/clipboard'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { Switch } from '@/components/ui/Switch'
import { Tabs } from '@/components/ui/Tabs'
import { toCurl } from '@/lib/codegen/curl'
import { cn } from '@/lib/cn'
import { faker } from '@/lib/faker'
import { sampleRequestBody, sampleUrl } from '@/lib/sample'
import { HTTP_METHODS, type Collection, type Endpoint, type HttpMethod } from '@/lib/types'
import { useWorkspace } from '@/store/workspace'
import { CodeTab } from './CodeTab'
import { MatchingTab } from './MatchingTab'
import { ResponsesTab } from './ResponsesTab'
import { useTryIt } from './useTryIt'

type EditorTab = 'responses' | 'matching' | 'code'

function validatePath(path: string): string | null {
  if (!path.startsWith('/')) return 'Paths start with "/"'
  if (/\s/.test(path)) return 'Paths cannot contain spaces'
  if (path.includes('?')) return 'Put query parameters in the Matching tab'
  if (/:(?![A-Za-z_])/.test(path)) return 'Params need a name, e.g. /users/:id'
  return null
}

export function EndpointEditor({
  collection,
  endpoint,
}: {
  collection: Collection
  endpoint: Endpoint
}) {
  const [tab, setTab] = useState<EditorTab>('responses')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { updateEndpoint, deleteEndpoint, duplicateEndpoint } = useWorkspace()
  const navigate = useNavigate()
  const tryIt = useTryIt()
  const update = (patch: Partial<Endpoint>) => updateEndpoint(collection.id, endpoint.id, patch)
  const pathError = validatePath(endpoint.path)
  const rulesCount =
    endpoint.variants.reduce((n, v) => n + v.rules.length, 0) + endpoint.query.length

  const copyCurl = () => {
    const body = sampleRequestBody(collection, endpoint, faker)
    const url = sampleUrl(collection, endpoint)
    void copyText(
      toCurl({
        method: endpoint.method,
        url: /^https?:/.test(url) ? url : location.origin + url,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      }),
      'cURL copied',
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="space-y-2.5 border-b border-line bg-surface px-4 pt-3 pb-0">
        <div className="flex items-start gap-2">
          <Link
            to={`/app/c/${collection.id}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden"
            aria-label="Back to endpoint list"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'flex h-9 min-w-0 items-stretch overflow-hidden rounded-lg border bg-surface transition-colors focus-within:ring-2 focus-within:ring-accent/20',
                pathError ? 'border-rose-500' : 'border-line focus-within:border-accent',
              )}
            >
              <select
                value={endpoint.method}
                onChange={(e) => update({ method: e.target.value as HttpMethod })}
                aria-label="HTTP method"
                disabled={!!endpoint.crud}
                className={cn(
                  'cursor-pointer border-r border-line bg-surface-2 pr-1 pl-2.5 font-mono text-xs font-bold outline-none disabled:cursor-default',
                  methodTextColor[endpoint.method],
                )}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="hidden items-center pl-2.5 font-mono text-[13px] text-subtle select-none sm:flex">
                {collection.baseUrl.replace(/\/+$/, '')}
              </span>
              <input
                value={endpoint.path}
                onChange={(e) => update({ path: e.target.value })}
                aria-label="Endpoint path"
                aria-invalid={!!pathError}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent pr-2 pl-2 font-mono text-[13px] outline-none sm:pl-0.5"
                placeholder="/users/:id"
              />
            </div>
            {pathError ? (
              <p className="mt-1 text-xs text-rose-500" role="alert">
                {pathError}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hidden h-9 items-center gap-2 rounded-lg border border-line px-2.5 sm:flex">
              <Switch
                checked={endpoint.enabled}
                onChange={(enabled) => update({ enabled })}
                label={endpoint.enabled ? 'Disable endpoint' : 'Enable endpoint'}
              />
              <span className="text-xs font-medium text-muted">
                {endpoint.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <Button
              variant="primary"
              onClick={() => tryIt(collection, endpoint)}
              disabled={!endpoint.enabled || !!pathError}
              title="Open in the API client"
            >
              <Play /> <span className="max-sm:sr-only">Try it</span>
            </Button>
            <Menu
              label="Endpoint actions"
              trigger={(props) => (
                <Button variant="ghost" size="icon" aria-label="Endpoint actions" {...props}>
                  <Ellipsis />
                </Button>
              )}
              items={[
                {
                  label: endpoint.enabled ? 'Disable' : 'Enable',
                  onSelect: () => update({ enabled: !endpoint.enabled }),
                },
                { label: 'Copy as cURL', icon: <Terminal />, onSelect: copyCurl },
                {
                  label: 'Duplicate',
                  icon: <Copy />,
                  onSelect: () => {
                    const copy = duplicateEndpoint(collection.id, endpoint.id)
                    if (copy) {
                      navigate(`/app/c/${collection.id}/e/${copy.id}`)
                      toast.success('Endpoint duplicated (disabled until you enable it)')
                    }
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash />,
                  danger: true,
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:pl-0">
          <input
            value={endpoint.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Untitled endpoint"
            aria-label="Endpoint name"
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none placeholder:text-subtle hover:bg-surface-2 focus:bg-surface-2"
          />
          <input
            value={endpoint.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Add a description"
            aria-label="Endpoint description"
            className="min-w-0 basis-full rounded-md bg-transparent px-1 py-0.5 text-[13px] text-muted outline-none placeholder:text-subtle hover:bg-surface-2 focus:bg-surface-2"
          />
        </div>
        <Tabs
          label="Endpoint sections"
          value={tab}
          onChange={setTab}
          className="border-b-0"
          items={[
            {
              id: 'responses',
              label: 'Responses',
              badge: (
                <span className="rounded-full bg-surface-2 px-1.5 text-[10.5px] text-muted">
                  {endpoint.variants.length}
                </span>
              ),
            },
            {
              id: 'matching',
              label: 'Matching',
              badge:
                endpoint.selection === 'rules' || rulesCount ? (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[10.5px] text-accent">
                    {endpoint.selection === 'rules' ? 'rules' : rulesCount}
                  </span>
                ) : undefined,
            },
            { id: 'code', label: 'Code' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'responses' ? (
          <ResponsesTab key={endpoint.id} collection={collection} endpoint={endpoint} />
        ) : null}
        {tab === 'matching' ? <MatchingTab collection={collection} endpoint={endpoint} /> : null}
        {tab === 'code' ? <CodeTab collection={collection} endpoint={endpoint} /> : null}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete endpoint?"
        description={
          <>
            <code className="font-mono text-fg">
              {endpoint.method} {endpoint.path}
            </code>{' '}
            and its {endpoint.variants.length} responses will be removed.
          </>
        }
        onConfirm={() => {
          deleteEndpoint(collection.id, endpoint.id)
          navigate(`/app/c/${collection.id}`)
          toast.success('Endpoint deleted')
        }}
      />
    </div>
  )
}
