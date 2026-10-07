import { Database, Plus, Search, Settings2, Sparkles, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import type { Collection } from '@/lib/types'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export function EndpointSidebar({
  collection,
  className,
}: {
  collection: Collection
  className?: string
}) {
  const [filter, setFilter] = useState('')
  const { addEndpoint, updateEndpoint } = useWorkspace()
  const set = useUi((s) => s.set)
  const navigate = useNavigate()

  const endpoints = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return collection.endpoints
    return collection.endpoints.filter((e) =>
      `${e.method} ${e.path} ${e.name}`.toLowerCase().includes(q),
    )
  }, [collection.endpoints, filter])

  const create = () => {
    const endpoint = addEndpoint(collection.id)
    navigate(`/app/c/${collection.id}/e/${endpoint.id}`)
  }

  return (
    <aside
      className={cn('flex min-h-0 flex-col border-r border-line bg-surface', className)}
      aria-label="Endpoints"
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{collection.name}</p>
          <p className="truncate text-[11px] text-subtle">
            {collection.endpoints.length} endpoints ·{' '}
            {collection.endpoints.filter((e) => e.enabled).length} enabled
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Collection settings"
          title="Collection settings"
          onClick={() => set({ collectionDialog: { mode: 'edit', id: collection.id } })}
        >
          <Settings2 />
        </Button>
      </div>
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter endpoints"
            aria-label="Filter endpoints"
            className="h-8 w-full rounded-lg border border-line bg-surface-2/50 pr-2 pl-8 text-[13px] placeholder:text-subtle focus:border-accent focus:bg-surface focus:outline-none"
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Endpoint list">
        {endpoints.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-subtle">
            {collection.endpoints.length ? 'No endpoints match the filter.' : 'No endpoints yet.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {endpoints.map((endpoint) => (
              <li key={endpoint.id} className="relative">
                <NavLink
                  to={`/app/c/${collection.id}/e/${endpoint.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg py-1.5 pr-11 pl-2 transition-colors',
                      isActive ? 'bg-accent-soft/70 ring-1 ring-accent/25' : 'hover:bg-surface-2',
                    )
                  }
                >
                  <span
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2.5',
                      !endpoint.enabled && 'opacity-50',
                    )}
                  >
                    <MethodBadge method={endpoint.method} compact />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[12.5px]">
                        {endpoint.path}
                      </span>
                      {endpoint.name ? (
                        <span className="block truncate text-[11px] text-subtle">
                          {endpoint.name}
                        </span>
                      ) : null}
                    </span>
                    {endpoint.crud ? (
                      <Database
                        className="size-3.5 shrink-0 text-subtle"
                        aria-label="Stateful CRUD endpoint"
                      />
                    ) : null}
                  </span>
                </NavLink>
                <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2">
                  <Switch
                    size="sm"
                    checked={endpoint.enabled}
                    onChange={(enabled) => updateEndpoint(collection.id, endpoint.id, { enabled })}
                    label={`${endpoint.enabled ? 'Disable' : 'Enable'} ${endpoint.method} ${endpoint.path}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 border-t border-line p-2.5">
        <Button variant="primary" size="sm" onClick={create}>
          <Plus /> Endpoint
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set({ resourceDialogOpen: true })}
          title="Generate a stateful REST resource"
        >
          <Sparkles /> Resource
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-8"
          aria-label="Import OpenAPI"
          title="Import OpenAPI"
          onClick={() => set({ importTab: 'openapi' })}
        >
          <Upload />
        </Button>
      </div>
    </aside>
  )
}
