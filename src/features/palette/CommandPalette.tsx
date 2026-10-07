import { Command } from 'cmdk'
import {
  Boxes,
  Database,
  Download,
  FolderOpen,
  House,
  Keyboard,
  LayoutGrid,
  Link2,
  Moon,
  Plus,
  ScrollText,
  Send,
  Settings2,
  Sparkles,
  Trash,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { copyText } from '@/lib/clipboard'
import { Kbd, MethodBadge } from '@/components/ui/Badge'
import { buildShareUrl } from '@/lib/serialize'
import { STARTER_TEMPLATES } from '@/lib/starters'
import { useLogs } from '@/store/logs'
import { useTheme } from '@/store/theme'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { useStarterTemplate } from '../collections/useStarterTemplate'

function Item({
  icon: Icon,
  children,
  onSelect,
  shortcut,
  value,
}: {
  icon?: LucideIcon
  children: ReactNode
  onSelect: () => void
  shortcut?: string[]
  value?: string
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-fg data-[selected=true]:bg-surface-2"
    >
      {Icon ? <Icon className="size-4 text-muted" aria-hidden /> : null}
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {shortcut ? (
        <span className="flex gap-1">
          {shortcut.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
      ) : null}
    </Command.Item>
  )
}

const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle'

export function CommandPalette({ collectionId }: { collectionId?: string }) {
  const open = useUi((s) => s.paletteOpen)
  const set = useUi((s) => s.set)
  const collections = useWorkspace((s) => s.collections)
  const collection = collections.find((c) => c.id === collectionId)
  const navigate = useNavigate()
  const toggleTheme = useTheme((s) => s.toggle)
  const applyTemplate = useStarterTemplate()

  const run = (fn: () => void) => () => {
    set({ paletteOpen: false })
    fn()
  }
  const base = collection ? `/app/c/${collection.id}` : null
  const alt = (k: string) => ['Alt', k]

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(paletteOpen) => set({ paletteOpen })}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-2xl"
    >
      <Command.Input
        placeholder={
          collection ? `Search ${collection.name} or run a command…` : 'Search or run a command…'
        }
        className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none placeholder:text-subtle"
      />
      <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
        <Command.Empty className="px-4 py-8 text-center text-sm text-muted">
          No results. Try “users” or “import”.
        </Command.Empty>

        {collection && base ? (
          <Command.Group heading={`Endpoints · ${collection.name}`} className={groupClass}>
            {collection.endpoints.map((e) => (
              <Item
                key={e.id}
                value={`endpoint ${e.method} ${e.path} ${e.name} ${e.id}`}
                onSelect={run(() => navigate(`${base}/e/${e.id}`))}
              >
                <MethodBadge method={e.method} compact />
                <code className="truncate text-[12.5px]">{e.path}</code>
                {e.name ? <span className="truncate text-xs text-subtle">{e.name}</span> : null}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Actions" className={groupClass}>
          {collection && base ? (
            <>
              <Item
                icon={Plus}
                shortcut={alt('N')}
                onSelect={run(() => {
                  const endpoint = useWorkspace.getState().addEndpoint(collection.id)
                  navigate(`${base}/e/${endpoint.id}`)
                })}
              >
                New endpoint
              </Item>
              <Item
                icon={Sparkles}
                shortcut={alt('R')}
                onSelect={run(() => set({ resourceDialogOpen: true }))}
              >
                Generate REST resource (stateful CRUD)
              </Item>
              <Item
                icon={Link2}
                onSelect={run(
                  () =>
                    void copyText(buildShareUrl(collection, location.origin), 'Share link copied'),
                )}
              >
                Copy share link
              </Item>
              <Item
                icon={Settings2}
                onSelect={run(() => set({ collectionDialog: { mode: 'edit', id: collection.id } }))}
              >
                Collection settings
              </Item>
            </>
          ) : null}
          <Item icon={Upload} onSelect={run(() => set({ importTab: 'openapi' }))}>
            Import OpenAPI spec
          </Item>
          <Item icon={FolderOpen} onSelect={run(() => set({ importTab: 'json' }))}>
            Import collection JSON
          </Item>
          <Item icon={Plus} onSelect={run(() => set({ collectionDialog: { mode: 'create' } }))}>
            New collection
          </Item>
          <Item icon={Trash} onSelect={run(() => useLogs.getState().clear())}>
            Clear request log
          </Item>
          <Item icon={Moon} onSelect={run(toggleTheme)}>
            Toggle dark / light theme
          </Item>
          <Item icon={Keyboard} shortcut={['?']} onSelect={run(() => set({ shortcutsOpen: true }))}>
            Keyboard shortcuts
          </Item>
        </Command.Group>

        {base ? (
          <Command.Group heading="Go to" className={groupClass}>
            <Item icon={Boxes} shortcut={alt('1')} onSelect={run(() => navigate(base))}>
              Endpoints
            </Item>
            <Item
              icon={Database}
              shortcut={alt('2')}
              onSelect={run(() => navigate(`${base}/resources`))}
            >
              Resources
            </Item>
            <Item icon={Send} shortcut={alt('3')} onSelect={run(() => navigate(`${base}/client`))}>
              API client
            </Item>
            <Item
              icon={ScrollText}
              shortcut={alt('4')}
              onSelect={run(() => navigate(`${base}/logs`))}
            >
              Request log
            </Item>
            <Item
              icon={Download}
              shortcut={alt('5')}
              onSelect={run(() => navigate(`${base}/export`))}
            >
              Export & share
            </Item>
          </Command.Group>
        ) : null}

        <Command.Group heading="Collections" className={groupClass}>
          {collections
            .filter((c) => c.id !== collectionId)
            .map((c) => (
              <Item
                key={c.id}
                icon={Boxes}
                value={`collection ${c.name} ${c.id}`}
                onSelect={run(() => navigate(`/app/c/${c.id}`))}
              >
                {c.name}
                <code className="truncate text-xs text-subtle">{c.baseUrl}</code>
              </Item>
            ))}
          <Item icon={LayoutGrid} onSelect={run(() => navigate('/app/collections'))}>
            All collections
          </Item>
          <Item icon={House} onSelect={run(() => navigate('/'))}>
            MockForge home
          </Item>
        </Command.Group>

        <Command.Group heading="Templates" className={groupClass}>
          {STARTER_TEMPLATES.map((t) => (
            <Item
              key={t.id}
              icon={Sparkles}
              value={`template ${t.name}`}
              onSelect={run(() => applyTemplate(t.id))}
            >
              Load template: {t.name}
            </Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
