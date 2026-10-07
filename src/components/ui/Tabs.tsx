import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  badge?: ReactNode
}

/** WAI-ARIA tablist with arrow-key navigation. Panels are rendered by the caller. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  variant = 'underline',
  label,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  variant?: 'underline' | 'pill'
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + items.length) % items.length
    refs.current[next]?.focus()
    onChange(items[next]!.id)
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex items-center',
        variant === 'underline'
          ? 'gap-4 border-b border-line'
          : 'gap-1 rounded-lg bg-surface-2 p-0.5',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            role="tab"
            type="button"
            id={`tab-${item.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              variant === 'underline'
                ? cn(
                    '-mb-px h-9 border-b-2',
                    selected
                      ? 'border-accent text-fg'
                      : 'border-transparent text-muted hover:text-fg',
                  )
                : cn(
                    'h-7 rounded-md px-2.5',
                    selected ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                  ),
            )}
          >
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
