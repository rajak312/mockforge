import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Lightweight dropdown menu with keyboard support (arrows, Esc, Enter). */
export function Menu({
  trigger,
  items,
  align = 'end',
  label,
}: {
  trigger: (props: {
    onClick: () => void
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
  }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled)
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
      enabled[next]?.focus()
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-50 mt-1 min-w-44 rounded-xl border border-line bg-surface p-1 shadow-panel',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none disabled:opacity-50 [&_svg]:size-4',
                item.danger
                  ? 'text-rose-600 hover:bg-rose-500/10 focus:bg-rose-500/10 dark:text-rose-400'
                  : 'text-fg hover:bg-surface-2 focus:bg-surface-2',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
