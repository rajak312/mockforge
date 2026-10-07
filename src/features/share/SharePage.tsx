import { Database, Link2Off, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/button-styles'
import { pluralize } from '@/lib/format'
import { decodeShare } from '@/lib/serialize'
import { useWorkspace } from '@/store/workspace'
import { ThemeToggle } from '../shell/HeaderControls'
import { Logo } from '../shell/Logo'

export default function SharePage() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const ready = useWorkspace((s) => s.ready)
  const addCollection = useWorkspace((s) => s.addCollection)

  const result = useMemo(() => {
    const payload = hash.replace(/^#/, '')
    if (!payload) return { ok: false as const, error: 'This link does not contain a collection.' }
    try {
      return { ok: true as const, collection: decodeShare(payload) }
    } catch (error) {
      return { ok: false as const, error: (error as Error).message }
    }
  }, [hash])

  const importIt = () => {
    if (!result.ok) return
    const added = addCollection(result.collection)
    toast.success(`Imported "${added.name}"`)
    navigate(`/app/c/${added.id}`, { replace: true })
  }

  return (
    <div className="grid-bg flex min-h-full flex-col bg-bg">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        {result.ok ? (
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
            <div className="border-b border-line px-6 py-5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Share2 className="size-3.5" /> Shared collection
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">
                {result.collection.name}
              </h1>
              {result.collection.description ? (
                <p className="mt-1 text-sm text-muted">{result.collection.description}</p>
              ) : null}
              <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-subtle">
                <code className="text-muted">{result.collection.baseUrl}</code>
                <span>{pluralize(result.collection.endpoints.length, 'endpoint')}</span>
                {result.collection.resources.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Database className="size-3" />
                    {pluralize(result.collection.resources.length, 'stateful resource')}
                  </span>
                ) : null}
              </p>
            </div>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {result.collection.endpoints.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-6 py-2">
                  <MethodBadge method={e.method} compact />
                  <code className="truncate text-[12.5px]">{e.path}</code>
                  <span className="ml-auto truncate text-xs text-subtle">{e.name}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-4">
              <p className="mr-auto text-xs text-subtle">
                Imports into this browser only. Nothing is uploaded.
              </p>
              <Link to="/" className={buttonClass('ghost')}>
                What is MockForge?
              </Link>
              <Button variant="primary" onClick={importIt} disabled={!ready}>
                Import collection
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-panel">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
              <Link2Off className="size-5" />
            </div>
            <h1 className="text-lg font-semibold">This share link can&apos;t be opened</h1>
            <p className="mt-2 text-sm text-muted">{result.error}</p>
            <p className="mt-1 text-xs text-subtle">
              Links can get cut off when pasted into chat apps. Ask for the collection JSON instead.
            </p>
            <Link to="/app" className={`${buttonClass('primary')} mt-6`}>
              Open workspace
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
