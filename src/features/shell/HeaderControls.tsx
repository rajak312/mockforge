import { Moon, Search, Sun } from 'lucide-react'
import { GithubIcon } from '@/components/ui/GithubIcon'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/Badge'
import { modKey } from '@/hooks/useHotkey'
import { cn } from '@/lib/cn'
import { useTheme } from '@/store/theme'
import { useUi } from '@/store/ui'
import { useWorkerStatus } from '@/store/worker-status'

export const REPO_URL = 'https://github.com/lalitkumarrajak/mockforge'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

export function GithubLink() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      aria-label="MockForge on GitHub"
      title="Source on GitHub"
    >
      <GithubIcon className="size-4" />
    </a>
  )
}

export function SearchButton() {
  const set = useUi((s) => s.set)
  return (
    <>
      <button
        type="button"
        onClick={() => set({ paletteOpen: true })}
        className="hidden h-8 w-52 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface-2/60 px-2.5 text-[13px] text-subtle transition-colors hover:border-line-strong hover:text-muted md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 truncate text-left">Search or jump to…</span>
        <Kbd>{modKey}</Kbd>
        <Kbd>K</Kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open command palette"
        onClick={() => set({ paletteOpen: true })}
      >
        <Search />
      </Button>
    </>
  )
}

export function WorkerStatusPill() {
  const { status, message, controlled } = useWorkerStatus()
  const live = status === 'ready' && controlled
  const label =
    status === 'starting'
      ? 'Starting mock worker…'
      : status === 'ready'
        ? controlled
          ? 'Mock service worker active'
          : 'Reload to let the worker control this tab'
        : status === 'unsupported'
          ? message
          : `Worker failed: ${message}`
  return (
    <div
      className="hidden h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-xs font-medium text-muted lg:flex"
      title={label}
      role="status"
      aria-label={label}
    >
      <span className="relative flex size-2">
        {live ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            live ? 'bg-emerald-500' : status === 'starting' ? 'bg-amber-400' : 'bg-rose-500',
          )}
        />
      </span>
      {live ? 'MSW live' : status === 'starting' ? 'Starting' : 'Offline'}
    </div>
  )
}
