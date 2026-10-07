import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { defaultRecordTemplate, RESOURCE_PRESET_NAMES } from '@/lib/crud'
import { faker } from '@/lib/faker'
import { joinUrl, normalizePath } from '@/lib/path-match'
import { resourceKey } from '@/lib/resource-store'
import type { Collection, CrudResource } from '@/lib/types'
import { resourceEvents, resourceStore } from '@/mocks/runtime'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { makeTemplateLinter } from '../endpoints/template-tools'
import { previewRecord } from './preview'

const lint = makeTemplateLinter(true, {})

/** "Generate REST resource" — one click to six stateful CRUD endpoints. */
export function ResourceDialog({ collection }: { collection: Collection }) {
  const open = useUi((s) => s.resourceDialogOpen)
  const set = useUi((s) => s.set)
  if (!open) return null
  return <ResourceForm collection={collection} onClose={() => set({ resourceDialogOpen: false })} />
}

function ResourceForm({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const [name, setName] = useState('users')
  const [template, setTemplate] = useState(defaultRecordTemplate('users'))
  const [templateTouched, setTemplateTouched] = useState(false)
  const [seedCount, setSeedCount] = useState(12)
  const addResource = useWorkspace((s) => s.addResource)
  const navigate = useNavigate()

  const clean = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const path = normalizePath(`/${clean}`)
  const conflict = collection.endpoints.some(
    (e) => e.path === path || e.path.startsWith(`${path}/:`),
  )
  const nameError = !clean
    ? 'Name the resource, e.g. users'
    : conflict
      ? `${path} already exists in this collection`
      : null
  const preview = useMemo(() => previewRecord(template), [template])

  const chooseName = (value: string) => {
    setName(value)
    if (!templateTouched) setTemplate(defaultRecordTemplate(value))
  }

  const create = () => {
    if (nameError || !preview.ok) return
    const { resource, endpoints } = addResource(collection.id, clean, {
      recordTemplate: template,
      seedCount,
    })
    resourceStore.seed(resourceKey(collection.id, resource.id), resource as CrudResource, faker)
    resourceEvents.emit()
    onClose()
    navigate(`/app/c/${collection.id}/e/${endpoints[0]!.id}`)
    toast.success(`Generated /${resource.name} with ${seedCount} records`, {
      description: 'GET, POST, PUT, PATCH and DELETE are live and stateful.',
    })
  }

  const base = collection.baseUrl.replace(/\/+$/, '')
  const routes: [string, string][] = [
    ['GET', path],
    ['POST', path],
    ['GET', `${path}/:id`],
    ['PUT', `${path}/:id`],
    ['PATCH', `${path}/:id`],
    ['DELETE', `${path}/:id`],
  ]

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Generate REST resource"
      description="Creates list / get / create / update / delete endpoints backed by a persistent store seeded with realistic data."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!!nameError || !preview.ok}>
            Generate 6 endpoints
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <Field label="Resource name" error={nameError}>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => chooseName(e.target.value)}
                invalid={!!nameError}
                className="font-mono"
                autoFocus
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-1.5" aria-label="Presets">
            {RESOURCE_PRESET_NAMES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTemplateTouched(false)
                  setName(preset)
                  setTemplate(defaultRecordTemplate(preset))
                }}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors',
                  clean === preset
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <Field
            label="Seed records"
            hint="Generated once, then persisted. You can reseed from the Resources tab."
          >
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
          <div>
            <p className="label mb-1.5">Endpoints</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {routes.map(([method, route]) => (
                <li key={`${method}${route}`} className="flex items-center gap-2.5 px-3 py-1.5">
                  <MethodBadge method={method} compact />
                  <code className="truncate text-[12px]">
                    <span className="text-subtle">{base}</span>
                    {route}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Record template
            </div>
            <CodeEditor
              value={template}
              onChange={(value) => {
                setTemplateTouched(true)
                setTemplate(value)
              }}
              language="template"
              lint={lint}
              ariaLabel="Record template"
              className="h-56"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center border-b border-line px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Sample record
              <code className="ml-auto font-normal tracking-normal normal-case">
                {joinUrl(base, `${path}/1`)}
              </code>
            </div>
            {preview.ok ? (
              <CodeEditor
                value={preview.value}
                readOnly
                ariaLabel="Sample record"
                className="h-44"
                lineNumbers={false}
              />
            ) : (
              <p className="px-3 py-4 text-sm text-rose-600 dark:text-rose-400" role="alert">
                {preview.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
