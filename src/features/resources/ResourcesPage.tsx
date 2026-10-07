import { Braces, Database, Ellipsis, Pencil, RotateCcw, Sparkles, Table, Trash } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Input } from '@/components/ui/Input'
import { Menu } from '@/components/ui/Menu'
import { faker } from '@/lib/faker'
import { pluralize } from '@/lib/format'
import { resourceKey, type ResourceRecord } from '@/lib/resource-store'
import type { Collection, CrudResource } from '@/lib/types'
import { resourceEvents, resourceStore } from '@/mocks/runtime'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { makeTemplateLinter } from '../endpoints/template-tools'
import { useCollection } from '../shell/useCollection'
import { previewRecord } from './preview'

const lint = makeTemplateLinter(true, {})

function useResourceVersion() {
  return useSyncExternalStore(resourceEvents.subscribe, resourceEvents.getVersion)
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function RecordsTable({ records, idField }: { records: ResourceRecord[]; idField: string }) {
  const columns = useMemo(() => {
    const keys = new Set<string>([idField])
    for (const r of records.slice(0, 50)) Object.keys(r).forEach((k) => keys.add(k))
    return [...keys].slice(0, 7)
  }, [records, idField])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead className="border-b border-line bg-surface-2/50 text-[11px] tracking-wide text-subtle uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.slice(0, 50).map((record, i) => (
            <tr key={String(record[idField] ?? i)} className="hover:bg-surface-2/40">
              {columns.map((c) => (
                <td
                  key={c}
                  className={`max-w-56 truncate px-3 py-1.5 ${c === idField ? 'font-mono text-subtle' : ''}`}
                  title={formatCell(record[c])}
                >
                  {formatCell(record[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 50 ? (
        <p className="border-t border-line px-3 py-2 text-xs text-subtle">
          Showing 50 of {records.length} records
        </p>
      ) : null}
    </div>
  )
}

function EditResourceDialog({
  collection,
  resource,
  onClose,
}: {
  collection: Collection
  resource: CrudResource
  onClose: () => void
}) {
  const [template, setTemplate] = useState(resource.recordTemplate)
  const [seedCount, setSeedCount] = useState(resource.seedCount)
  const updateResource = useWorkspace((s) => s.updateResource)
  const preview = useMemo(() => previewRecord(template), [template])
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Edit /${resource.name}`}
      description="Changes apply the next time you reseed. Existing records are kept until then."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!preview.ok}
            onClick={() => {
              updateResource(collection.id, resource.id, { recordTemplate: template, seedCount })
              const updated = { ...resource, recordTemplate: template, seedCount }
              resourceStore.seed(resourceKey(collection.id, resource.id), updated, faker)
              resourceEvents.emit()
              toast.success(`Reseeded ${pluralize(seedCount, 'record')}`)
              onClose()
            }}
          >
            Save & reseed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Seed records">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={500}
              value={seedCount}
              onChange={(e) =>
                setSeedCount(Math.max(0, Math.min(500, Number(e.target.value) || 0)))
              }
              className="w-32 font-mono"
            />
          )}
        </Field>
        <div className="overflow-hidden rounded-xl border border-line">
          <CodeEditor
            value={template}
            onChange={setTemplate}
            language="template"
            lint={lint}
            ariaLabel="Record template"
            className="h-64"
          />
        </div>
        {!preview.ok ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {preview.error}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

function ResourceCard({
  collection,
  resource,
}: {
  collection: Collection
  resource: CrudResource
}) {
  useResourceVersion()
  const key = resourceKey(collection.id, resource.id)
  const seeded = resourceStore.has(key)
  const records = seeded ? resourceStore.all(key) : []
  const [view, setView] = useState<'table' | 'json'>('table')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteResource = useWorkspace((s) => s.deleteResource)
  const endpoints = collection.endpoints.filter((e) => e.crud?.resourceId === resource.id)

  const reseed = () => {
    try {
      resourceStore.seed(key, resource, faker)
      resourceEvents.emit()
      toast.success(`Reseeded ${pluralize(resource.seedCount, 'record')}`)
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
          <Database className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            <code>/{resource.name}</code>
          </h2>
          <p className="text-xs text-subtle">
            {seeded ? pluralize(records.length, 'record') : 'Seeds on first request'} · id field{' '}
            <code>{resource.idField}</code> · {pluralize(endpoints.length, 'endpoint')}
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5"
          role="group"
          aria-label="View mode"
        >
          <Button
            size="xs"
            variant={view === 'table' ? 'outline' : 'ghost'}
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
          >
            <Table /> Table
          </Button>
          <Button
            size="xs"
            variant={view === 'json' ? 'outline' : 'ghost'}
            aria-pressed={view === 'json'}
            onClick={() => setView('json')}
          >
            <Braces /> JSON
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={reseed}>
          <RotateCcw /> Reseed
        </Button>
        <Menu
          label={`Actions for ${resource.name}`}
          trigger={(props) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${resource.name}`}
              {...props}
            >
              <Ellipsis />
            </Button>
          )}
          items={[
            { label: 'Edit template', icon: <Pencil />, onSelect: () => setEditing(true) },
            {
              label: 'Clear all records',
              icon: <Trash />,
              onSelect: () => {
                resourceStore.replace(key, [])
                resourceEvents.emit()
                toast.success('All records removed')
              },
            },
            {
              label: 'Delete resource',
              icon: <Trash />,
              danger: true,
              onSelect: () => setConfirmDelete(true),
            },
          ]}
        />
      </header>
      <div className="flex flex-wrap gap-1.5 border-b border-line bg-surface-2/30 px-4 py-2">
        {endpoints.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-0.5"
          >
            <MethodBadge method={e.method} compact className="h-4 min-w-9 text-[9.5px]" />
            <code className="text-[11px] text-muted">{e.path}</code>
          </span>
        ))}
      </div>
      {!seeded ? (
        <div className="px-4 py-8 text-center text-sm text-muted">
          No data yet.{' '}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={reseed}
          >
            Seed {resource.seedCount} records now
          </button>
        </div>
      ) : records.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          The table is empty. POST to /{resource.name} or reseed.
        </p>
      ) : view === 'table' ? (
        <RecordsTable records={records} idField={resource.idField} />
      ) : (
        <CodeEditor
          value={JSON.stringify(records, null, 2)}
          readOnly
          ariaLabel={`${resource.name} records`}
          className="max-h-96 overflow-auto"
        />
      )}
      {editing ? (
        <EditResourceDialog
          collection={collection}
          resource={resource}
          onClose={() => setEditing(false)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete /${resource.name}?`}
        description={`Its ${endpoints.length} endpoints and ${records.length} stored records will be removed.`}
        onConfirm={() => {
          deleteResource(collection.id, resource.id)
          toast.success('Resource deleted')
        }}
      />
    </article>
  )
}

export default function ResourcesPage() {
  const collection = useCollection()
  const set = useUi((s) => s.set)
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold tracking-tight">Resources</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Stateful collections of records behind generated CRUD endpoints. Writes persist in
              IndexedDB, so your frontend sees its own changes — across reloads.
            </p>
          </div>
          <Button variant="primary" onClick={() => set({ resourceDialogOpen: true })}>
            <Sparkles /> Generate resource
          </Button>
        </div>
        {collection.resources.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Database}
              title="No resources yet"
              description="Generate a resource like “users” to get list, get, create, update and delete endpoints with seeded data."
              action={
                <Button variant="primary" onClick={() => set({ resourceDialogOpen: true })}>
                  <Sparkles /> Generate REST resource
                </Button>
              }
            />
          </div>
        ) : (
          collection.resources.map((resource) => (
            <ResourceCard key={resource.id} collection={collection} resource={resource} />
          ))
        )}
      </div>
    </div>
  )
}
