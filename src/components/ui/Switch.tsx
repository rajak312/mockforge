import { cn } from '@/lib/cn'

export function Switch({
  checked,
  onChange,
  label,
  size = 'md',
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'bg-emerald-500' : 'bg-surface-3 ring-1 ring-line-strong ring-inset',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform',
          size === 'sm' ? 'size-3' : 'size-4',
          checked ? (size === 'sm' ? 'translate-x-3.5' : 'translate-x-[18px]') : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
