import { Check, ChevronsUpDown, LayoutGrid, Plus, Upload } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Menu } from '@/components/ui/Menu'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export function CollectionSwitcher({ currentId }: { currentId?: string }) {
  const collections = useWorkspace((s) => s.collections)
  const current = collections.find((c) => c.id === currentId)
  const navigate = useNavigate()
  const set = useUi((s) => s.set)

  return (
    <Menu
      label="Switch collection"
      align="start"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex h-9 max-w-[52vw] min-w-0 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-surface-2 sm:max-w-64"
        >
          <span className="min-w-0">
            <span className="block truncate text-[13px] leading-tight font-semibold">
              {current?.name ?? 'Collections'}
            </span>
            {current ? (
              <span className="block truncate font-mono text-[10.5px] leading-tight text-subtle">
                {current.baseUrl}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" aria-hidden />
        </button>
      )}
      items={[
        ...collections.slice(0, 12).map((c) => ({
          label: c.name,
          icon:
            c.id === currentId ? <Check className="text-accent" /> : <span className="size-4" />,
          onSelect: () => navigate(`/app/c/${c.id}`),
        })),
        {
          label: 'All collections',
          icon: <LayoutGrid />,
          onSelect: () => navigate('/app/collections'),
        },
        {
          label: 'New collection',
          icon: <Plus />,
          onSelect: () => set({ collectionDialog: { mode: 'create' } }),
        },
        { label: 'Import…', icon: <Upload />, onSelect: () => set({ importTab: 'openapi' }) },
      ]}
    />
  )
}
