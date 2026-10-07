import { Kbd } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { modKey } from '@/hooks/useHotkey'
import { useUi } from '@/store/ui'

const SHORTCUTS: [string, string[]][] = [
  ['Command palette', [modKey, 'K']],
  ['Send request (API client)', [modKey, 'Enter']],
  ['New endpoint', ['Alt', 'N']],
  ['Generate REST resource', ['Alt', 'R']],
  ['Endpoints · Resources · Client · Logs · Export', ['Alt', '1–5']],
  ['Save (changes save automatically)', [modKey, 'S']],
  ['Show this help', ['?']],
  ['Close dialog', ['Esc']],
]

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  const set = useUi((s) => s.set)
  return (
    <Dialog
      open={open}
      onClose={() => set({ shortcutsOpen: false })}
      title="Keyboard shortcuts"
      size="sm"
    >
      <ul className="divide-y divide-line">
        {SHORTCUTS.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-muted">{label}</span>
            <span className="flex shrink-0 gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
