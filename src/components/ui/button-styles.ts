import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm shadow-accent/20',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
  outline: 'border border-line bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

const sizes: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'size-9 rounded-lg',
  'icon-sm': 'size-7 rounded-md',
}

/** Class names for button-styled elements (also used for links). */
export const buttonClass = (
  variant: Variant = 'secondary',
  size: Size = 'md',
  className?: string,
) =>
  cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    className,
  )
