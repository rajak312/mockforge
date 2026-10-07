import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the custom theme tokens so e.g. `text-muted` and `text-xs` don't clash.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'bg',
        'surface',
        'surface-2',
        'surface-3',
        'line',
        'line-strong',
        'fg',
        'muted',
        'subtle',
        'accent',
        'accent-hover',
        'accent-soft',
        'accent-fg',
        'ring',
        'code',
      ],
    },
  },
})

/** Joins class names and resolves conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
