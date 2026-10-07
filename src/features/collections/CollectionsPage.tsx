import {
  Copy,
  Ellipsis,
  Newspaper,
  Plus,
  Settings2,
  Shield,
  ShoppingCart,
  Trash,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Pill } from '@/components/ui/Badge'
import { methodTextColor } from '@/components/ui/badge-styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { cn } from '@/lib/cn'
import { pluralize, timeAgo } from '@/lib/format'
import { STARTER_TEMPLATES, type StarterTemplate } from '@/lib/starters'
import { HTTP_METHODS, type Collection } from '@/lib/types'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { useStarterTemplate } from './useStarterTemplate'

const TEMPLATE_ICONS: Record<StarterTemplate['icon'], LucideIcon> = {
  'shopping-cart': ShoppingCart,
  newspaper: Newspaper,
  shield: Shield,
}

const METHOD_BAR: Record<string, string> = {
  GET: 'bg-emerald-500',
  POST: 'bg-sky-500',
  PUT: 'bg-amber-500',
  PATCH: 'bg-violet-500',
  DELETE: 'bg-rose-500',
  HEAD: 'bg-slate-400',
  OPTIONS: 'bg-slate-400',
}

function MethodDistribution({ collection }: { collection: Collection }) {
  const total = collection.endpoints.length
  if (!total) return <div className="h-1.5 rounded-full bg-surface-3" />
  const counts = HTTP_METHODS.map(
    (m) => [m, collection.endpoints.filter((e) => e.method === m).length] as const,
  ).filter(([, n]) => n)
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {counts.map(([method, n]) => (
          <div
            key={method}
            className={METHOD_BAR[method]}
            style={{ width: `${(n / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px]">
        {counts.map(([method, n]) => (
          <span key={method} className={methodTextColor[method]}>
            {method} {n}
          </span>
        ))}
      </p>
    </div>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  const { duplicateCollection, deleteCollection } = useWorkspace()
  const set = useUi((s) => s.set)
  const [confirm, setConfirm] = useState(false)
  return (
    <article className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 transition-all hover:border-line-strong hover:shadow-panel">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            <Link
              to={`/app/c/${collection.id}`}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {collection.name}
            </Link>
          </h3>
          <code className="mt-0.5 block truncate text-xs text-muted">{collection.baseUrl}</code>
        </div>
        <div className="relative z-10">
          <Menu
            label={`Actions for ${collection.name}`}
            trigger={(props) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${collection.name}`}
                {...props}
              >
                <Ellipsis />
              </Button>
            )}
            items={[
              {
                label: 'Settings',
                icon: <Settings2 />,
                onSelect: () => set({ collectionDialog: { mode: 'edit', id: collection.id } }),
              },
              {
                label: 'Duplicate',
                icon: <Copy />,
                onSelect: () => {
                  duplicateCollection(collection.id)
                  toast.success('Collection duplicated')
                },
              },
              { label: 'Delete', icon: <Trash />, danger: true, onSelect: () => setConfirm(true) },
            ]}
          />
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted">
        {collection.description || 'No description yet.'}
      </p>
      <div className="mt-4">
        <MethodDistribution collection={collection} />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-subtle">
        <span>{pluralize(collection.endpoints.length, 'endpoint')}</span>
        {collection.resources.length ? (
          <span>· {pluralize(collection.resources.length, 'resource')}</span>
        ) : null}
        <span className="ml-auto">Updated {timeAgo(collection.updatedAt)}</span>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete "${collection.name}"?`}
        description="All endpoints and stored resource data in this collection will be removed."
        onConfirm={() => {
          deleteCollection(collection.id)
          toast.success('Collection deleted')
        }}
      />
    </article>
  )
}

export function TemplateGallery({ compact = false }: { compact?: boolean }) {
  const applyTemplate = useStarterTemplate()
  return (
    <div className={cn('grid gap-4', compact ? 'sm:grid-cols-3' : 'md:grid-cols-3')}>
      {STARTER_TEMPLATES.map((template) => {
        const Icon = TEMPLATE_ICONS[template.icon]
        return (
          <article
            key={template.id}
            className="flex flex-col rounded-2xl border border-dashed border-line-strong bg-surface/60 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-4" />
              </div>
              <h3 className="font-semibold">{template.name}</h3>
            </div>
            <p className="mt-3 flex-1 text-sm text-muted">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.highlights.map((h) => (
                <Pill key={h}>{h}</Pill>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 self-start"
              onClick={() => applyTemplate(template.id)}
            >
              Use template
            </Button>
          </article>
        )
      })}
    </div>
  )
}

export default function CollectionsPage() {
  const collections = useWorkspace((s) => s.collections)
  const set = useUi((s) => s.set)
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
            <p className="mt-1 text-sm text-muted">
              Each collection is a mock API with its own base URL. Everything is stored in this
              browser.
            </p>
          </div>
          <Button variant="outline" onClick={() => set({ importTab: 'openapi' })}>
            <Upload /> Import
          </Button>
          <Button variant="primary" onClick={() => set({ collectionDialog: { mode: 'create' } })}>
            <Plus /> New collection
          </Button>
        </div>

        {collections.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <h2 className="font-semibold">No collections yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Start from a template below, import an OpenAPI spec, or create an empty collection and
              add endpoints by hand.
            </p>
          </div>
        )}

        <section className="mt-12" aria-labelledby="templates-heading">
          <h2 id="templates-heading" className="text-sm font-semibold">
            Start from a template
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Realistic, fully editable APIs that showcase templating, rules and stateful CRUD.
          </p>
          <TemplateGallery />
        </section>
      </div>
    </div>
  )
}
