import {
  ChevronDown,
  Copy,
  Database,
  Ellipsis,
  Plus,
  Star,
  Trash,
  WandSparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { KeyValueEditor } from '@/components/KeyValueEditor'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Menu } from '@/components/ui/Menu'
import { cn } from '@/lib/cn'
import { createVariant } from '@/lib/factory'
import {
  HEADER_SUGGESTIONS,
  COMMON_STATUSES,
  isNullBodyStatus,
  statusText,
  tryFormatJson,
} from '@/lib/http'
import { createId } from '@/lib/id'
import { extractParamNames } from '@/lib/path-match'
import type { Collection, Endpoint, ResponseVariant } from '@/lib/types'
import { useWorkspace } from '@/store/workspace'
import { makeTemplateLinter } from './template-tools'
import { TemplatePreview } from './TemplatePreview'

function isJsonVariant(variant: ResponseVariant) {
  const type =
    variant.headers.find((h) => h.enabled && h.key.toLowerCase() === 'content-type')?.value ?? ''
  return type.includes('json') || !type
}

export function ResponsesTab({
  collection,
  endpoint,
}: {
  collection: Collection
  endpoint: Endpoint
}) {
  const [selectedId, setSelectedId] = useState(endpoint.activeVariantId)
  const { updateEndpoint } = useWorkspace()
  const variant = endpoint.variants.find((v) => v.id === selectedId) ?? endpoint.variants[0]!

  const addVariant = () => {
    const created = createVariant({
      name: `Response ${endpoint.variants.length + 1}`,
      status: 400,
      body: '{\n  "error": "bad_request"\n}',
    })
    updateEndpoint(collection.id, endpoint.id, (e) => ({
      ...e,
      variants: [...e.variants, created],
    }))
    setSelectedId(created.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-4 py-2"
        role="tablist"
        aria-label="Response variants"
      >
        {endpoint.variants.map((v) => {
          const active = v.id === endpoint.activeVariantId
          const selected = v.id === variant.id
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
                selected
                  ? 'border-accent/50 bg-accent-soft/60 text-fg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {v.fromStore ? (
                <Database className="size-3.5 text-subtle" />
              ) : (
                <StatusBadge status={v.status} />
              )}
              <span className="max-w-40 truncate">{v.name}</span>
              {active ? (
                <Star
                  className="size-3 fill-amber-400 text-amber-400"
                  aria-label="Active response"
                />
              ) : null}
            </button>
          )
        })}
        <Button size="sm" variant="ghost" onClick={addVariant} className="shrink-0">
          <Plus /> Add response
        </Button>
      </div>
      <VariantEditor
        key={variant.id}
        collection={collection}
        endpoint={endpoint}
        variant={variant}
        onSelect={setSelectedId}
      />
    </div>
  )
}

function VariantEditor({
  collection,
  endpoint,
  variant,
  onSelect,
}: {
  collection: Collection
  endpoint: Endpoint
  variant: ResponseVariant
  onSelect: (id: string) => void
}) {
  const { updateVariant, updateEndpoint } = useWorkspace()
  const [headersOpen, setHeadersOpen] = useState(variant.headers.length > 1)
  const update = (patch: Partial<ResponseVariant>) =>
    updateVariant(collection.id, endpoint.id, variant.id, patch)
  const isActive = endpoint.activeVariantId === variant.id
  const expectJson = isJsonVariant(variant)
  const paramNames = useMemo(() => extractParamNames(endpoint.path), [endpoint.path])
  const usesBody = /\{\{\s*body/.test(variant.body)
  const lint = useMemo(
    () =>
      makeTemplateLinter(expectJson, {
        params: Object.fromEntries(paramNames.map((p) => [p, '1'])),
        query: {},
        body: {},
      }),
    [expectJson, paramNames],
  )
  const resource = endpoint.crud
    ? collection.resources.find((r) => r.id === endpoint.crud!.resourceId)
    : undefined
  const nullBody = isNullBodyStatus(variant.status)

  const duplicate = () => {
    const copy = {
      ...structuredClone(variant),
      id: createId(),
      name: `${variant.name} copy`,
      fromStore: undefined,
    }
    updateEndpoint(collection.id, endpoint.id, (e) => ({ ...e, variants: [...e.variants, copy] }))
    onSelect(copy.id)
  }
  const remove = () => {
    updateEndpoint(collection.id, endpoint.id, (e) => {
      const variants = e.variants.filter((v) => v.id !== variant.id)
      return {
        ...e,
        variants,
        activeVariantId: e.activeVariantId === variant.id ? variants[0]!.id : e.activeVariantId,
      }
    })
    onSelect(endpoint.variants.find((v) => v.id !== variant.id)!.id)
  }
  const format = () => {
    const formatted = tryFormatJson(variant.body)
    if (formatted.ok) update({ body: formatted.value })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <datalist id="status-codes">
          {COMMON_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusText(s)}
            </option>
          ))}
        </datalist>

        <label className="min-w-40 flex-1 space-y-1">
          <span className="label">Response name</span>
          <Input
            value={variant.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-8"
          />
        </label>
        <label className="w-36 space-y-1">
          <span className="label">Status</span>
          <div className="relative">
            <Input
              type="number"
              min={200}
              max={599}
              list="status-codes"
              value={variant.status}
              disabled={variant.fromStore}
              onChange={(e) =>
                update({ status: Math.max(200, Math.min(599, Number(e.target.value) || 200)) })
              }
              className="h-8 pr-16 font-mono"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 max-w-14 -translate-y-1/2 truncate text-[10.5px] text-subtle">
              {variant.fromStore ? 'dynamic' : statusText(variant.status)}
            </span>
          </div>
        </label>
        <label className="w-28 space-y-1">
          <span className="label">Delay</span>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={60000}
              step={50}
              value={variant.delay}
              onChange={(e) =>
                update({ delay: Math.max(0, Math.min(60000, Number(e.target.value) || 0)) })
              }
              className="h-8 pr-8 font-mono"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-subtle">
              ms
            </span>
          </div>
        </label>
        <div className="flex items-center gap-1.5 pb-px">
          {isActive ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Star className="size-3.5 fill-current" />
              {endpoint.selection === 'rules' ? 'Fallback' : 'Active'}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateEndpoint(collection.id, endpoint.id, { activeVariantId: variant.id })
              }
            >
              <Star /> Set active
            </Button>
          )}
          <Menu
            label="Response actions"
            trigger={(props) => (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8"
                aria-label="Response actions"
                {...props}
              >
                <Ellipsis />
              </Button>
            )}
            items={[
              { label: 'Duplicate response', icon: <Copy />, onSelect: duplicate },
              {
                label: 'Format JSON',
                icon: <WandSparkles />,
                onSelect: format,
                disabled: variant.fromStore || !expectJson,
              },
              {
                label: 'Delete response',
                icon: <Trash />,
                onSelect: remove,
                danger: true,
                disabled: endpoint.variants.length < 2,
              },
            ]}
          />
        </div>
      </div>

      <div className="px-4">
        <button
          type="button"
          aria-expanded={headersOpen}
          onClick={() => setHeadersOpen((o) => !o)}
          className="flex items-center gap-1.5 py-1 text-xs font-medium text-muted hover:text-fg"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', !headersOpen && '-rotate-90')}
          />
          Response headers
          <span className="rounded-full bg-surface-2 px-1.5 text-[10.5px]">
            {variant.headers.filter((h) => h.enabled && h.key).length}
          </span>
        </button>
        {headersOpen ? (
          <div className="mt-1.5 mb-1">
            <KeyValueEditor
              label="Headers"
              items={variant.headers}
              onChange={(headers) => update({ headers })}
              keyPlaceholder="Header"
              suggestions={HEADER_SUGGESTIONS}
            />
          </div>
        ) : null}
      </div>

      {variant.fromStore ? (
        <StoreBackedInfo
          collection={collection}
          endpoint={endpoint}
          resourceName={resource?.name}
        />
      ) : nullBody ? (
        <p className="m-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {variant.status} responses never include a body, so there is nothing to edit here.
        </p>
      ) : (
        <div className="m-4 grid min-h-[420px] flex-1 overflow-hidden rounded-xl border border-line lg:grid-cols-2">
          <section
            className="flex min-h-72 flex-col border-b border-line lg:border-r lg:border-b-0"
            aria-label="Response body template"
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Body template
              </h3>
              <span className="hidden text-[11px] text-subtle sm:inline">
                type <code className="rounded bg-surface-2 px-1">{'{{'}</code> for helpers
              </span>
              {expectJson ? (
                <Button size="xs" variant="ghost" className="ml-auto" onClick={format}>
                  <WandSparkles /> Format
                </Button>
              ) : null}
            </div>
            <CodeEditor
              value={variant.body}
              onChange={(body) => update({ body })}
              language={expectJson ? 'template' : 'text'}
              lint={lint}
              params={paramNames}
              ariaLabel="Response body template"
              placeholder='{ "message": "Hello {{faker.person.firstName}}" }'
              className="flex-1"
            />
          </section>
          <TemplatePreview
            template={variant.body}
            expectJson={expectJson}
            paramNames={paramNames}
            usesBody={usesBody}
          />
        </div>
      )}
    </div>
  )
}

function StoreBackedInfo({
  collection,
  endpoint,
  resourceName,
}: {
  collection: Collection
  endpoint: Endpoint
  resourceName?: string
}) {
  const action = endpoint.crud?.action
  const descriptions: Record<string, string> = {
    list: 'Returns { data, meta } with pagination. Supports ?page, ?limit (max 100), ?q full-text search, ?sort=field&order=desc and exact filters like ?role=admin.',
    get: 'Returns the record with the matching id, or 404.',
    create:
      'Validates that the body is a JSON object, assigns the next id and responds 201 with the stored record.',
    update:
      endpoint.method === 'PATCH'
        ? 'Merges the JSON body into the record (PATCH semantics).'
        : 'Replaces the record with the JSON body, keeping its id (PUT semantics).',
    delete: 'Removes the record and responds 204, or 404 if it does not exist.',
  }
  return (
    <div className="m-4 rounded-xl border border-accent/25 bg-accent-soft/40 p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
          <Database className="size-4" />
        </div>
        <div className="min-w-0 text-sm">
          <h3 className="font-semibold">
            Stateful response from the “{resourceName ?? 'deleted'}” store
          </h3>
          <p className="mt-1 text-muted">{action ? descriptions[action] : null}</p>
          <p className="mt-2 text-muted">
            Data persists in IndexedDB, so a POST followed by a GET reflects the change — even after
            a reload. Add another response (e.g. a 500) and set it active to simulate failures.
          </p>
          <Link
            to={`/app/c/${collection.id}/resources`}
            className="mt-3 inline-flex text-[13px] font-medium text-accent hover:underline"
          >
            Browse & reset data →
          </Link>
        </div>
      </div>
    </div>
  )
}
