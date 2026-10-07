import { Suspense } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useHotkey } from '@/hooks/useHotkey'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { CollectionDialog } from '../collections/CollectionDialog'
import { ImportDialog } from '../collections/ImportDialog'
import { CommandPalette } from '../palette/CommandPalette'
import { ShortcutsDialog } from '../palette/ShortcutsDialog'
import { CollectionNav } from './CollectionNav'
import { CollectionSwitcher } from './CollectionSwitcher'
import { GithubLink, SearchButton, ThemeToggle, WorkerStatusPill } from './HeaderControls'
import { Logo } from './Logo'
import { WorkerBanner } from './WorkerBanner'

function Spinner() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-label="Loading">
      <div className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  )
}

export default function AppShell() {
  const ready = useWorkspace((s) => s.ready)
  const match = useMatch('/app/c/:collectionId/*')
  const collectionId = match?.params.collectionId
  const set = useUi((s) => s.set)
  const navigate = useNavigate()

  useHotkey('mod+k', () => set({ paletteOpen: !useUi.getState().paletteOpen }))
  useHotkey('?', () => set({ shortcutsOpen: true }))
  useHotkey('mod+s', () => toast.success('All changes are saved automatically', { id: 'autosave' }))
  useHotkey('alt+n', () => {
    if (!collectionId) return
    const endpoint = useWorkspace.getState().addEndpoint(collectionId)
    navigate(`/app/c/${collectionId}/e/${endpoint.id}`)
  })
  useHotkey('alt+r', () => collectionId && set({ resourceDialogOpen: true }))
  const goTo = (section: string) => collectionId && navigate(`/app/c/${collectionId}${section}`)
  useHotkey('alt+1', () => goTo(''))
  useHotkey('alt+2', () => goTo('/resources'))
  useHotkey('alt+3', () => goTo('/client'))
  useHotkey('alt+4', () => goTo('/logs'))
  useHotkey('alt+5', () => goTo('/export'))

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <Logo to="/" compact />
        <span className="text-lg font-light text-line-strong select-none" aria-hidden>
          /
        </span>
        <CollectionSwitcher currentId={collectionId} />
        {collectionId ? (
          <CollectionNav collectionId={collectionId} className="ml-2 hidden xl:flex" />
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <SearchButton />
          <WorkerStatusPill />
          <ThemeToggle />
          <GithubLink />
        </div>
      </header>
      {collectionId ? (
        <div className="overflow-x-auto border-b border-line bg-surface px-2 py-1 xl:hidden">
          <CollectionNav collectionId={collectionId} />
        </div>
      ) : null}
      <WorkerBanner />
      <main id="main" className="min-h-0 flex-1">
        {ready ? (
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        ) : (
          <Spinner />
        )}
      </main>
      <CommandPalette collectionId={collectionId} />
      <ImportDialog />
      <ShortcutsDialog />
      <CollectionDialog />
    </div>
  )
}
