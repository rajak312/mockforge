import { Link } from 'react-router'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="mf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#5b45f0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#mf-logo)" />
      <path
        d="M9 22V10l7 7 7-7v12"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg font-semibold tracking-tight"
      aria-label="MockForge home"
    >
      <LogoMark />
      <span className={cn('text-[15px]', compact && 'max-sm:sr-only')}>MockForge</span>
    </Link>
  )
}
