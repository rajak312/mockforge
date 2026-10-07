import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { statusText } from '@/lib/http'
import { METHOD_STYLES, statusTone } from './badge-styles'

export function MethodBadge({
  method,
  className,
  compact,
}: {
  method: string
  className?: string
  compact?: boolean
}) {
  const upper = method.toUpperCase()
  const label =
    compact && upper === 'DELETE' ? 'DEL' : compact && upper === 'OPTIONS' ? 'OPT' : upper
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-11 items-center justify-center rounded px-1.5 font-mono text-[10.5px] font-semibold tracking-wide',
        METHOD_STYLES[upper] ?? METHOD_STYLES.GET,
        className,
      )}
    >
      {label}
    </span>
  )
}

export function StatusBadge({
  status,
  withText,
  className,
}: {
  status: number
  withText?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded px-1.5 font-mono text-[11px] font-semibold',
        statusTone(status),
        className,
      )}
    >
      {status}
      {withText && statusText(status) ? (
        <span className="font-sans font-medium">{statusText(status)}</span>
      ) : null}
    </span>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line border-b-2 bg-surface px-1 font-sans text-[10.5px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
