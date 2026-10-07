import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '@/lib/clipboard'
import { Button, type ButtonProps } from './Button'

export function CopyButton({
  text,
  label = 'Copy',
  toastLabel,
  showLabel = true,
  ...props
}: {
  text: string | (() => string)
  label?: string
  toastLabel?: string
  showLabel?: boolean
} & Omit<ButtonProps, 'onClick'>) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size={showLabel ? 'sm' : 'icon-sm'}
      variant="ghost"
      aria-label={label}
      title={label}
      {...props}
      onClick={async () => {
        if (await copyText(typeof text === 'function' ? text() : text, toastLabel)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <Check className="text-emerald-500" /> : <Copy />}
      {showLabel ? (copied ? 'Copied' : label) : null}
    </Button>
  )
}
