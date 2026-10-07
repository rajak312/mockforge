import { Boxes, Database, Download, ScrollText, Send } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { cn } from '@/lib/cn'
import { useLogs } from '@/store/logs'

export function CollectionNav({
  collectionId,
  className,
}: {
  collectionId: string
  className?: string
}) {
  const unseen = useLogs((s) => s.unseen)
  const { pathname } = useLocation()
  const base = `/app/c/${collectionId}`
  const endpointsActive = pathname === base || pathname.startsWith(`${base}/e/`)
  const items = [
    { to: base, label: 'Endpoints', icon: Boxes, active: endpointsActive },
    { to: `${base}/resources`, label: 'Resources', icon: Database },
    { to: `${base}/client`, label: 'Client', icon: Send },
    { to: `${base}/logs`, label: 'Logs', icon: ScrollText, badge: unseen },
    { to: `${base}/export`, label: 'Export', icon: Download },
  ]
  return (
    <nav aria-label="Collection" className={cn('flex items-center gap-0.5', className)}>
      {items.map(({ to, label, icon: Icon, active, badge }) => (
        <NavLink
          key={label}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              (active ?? isActive)
                ? 'bg-surface-2 text-fg'
                : 'text-muted hover:bg-surface-2/60 hover:text-fg',
            )
          }
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
          {badge ? (
            <span
              className="ml-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-accent-fg"
              aria-label={`${badge} new`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  )
}
