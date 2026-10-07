import { Plus, X } from 'lucide-react'
import { createKeyValue } from '@/lib/factory'
import type { KeyValue } from '@/lib/types'
import { Button } from './ui/Button'

const cellInput =
  'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 font-mono text-[12.5px] text-fg placeholder:text-subtle hover:border-line focus:border-accent focus:bg-surface focus:outline-none'

/** Editable list of key/value pairs (headers, query params). */
export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  label,
  suggestions,
}: {
  items: KeyValue[]
  onChange: (items: KeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  label: string
  suggestions?: string[]
}) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const listId = suggestions ? `${label.replace(/\W+/g, '-')}-suggestions` : undefined
  return (
    <div className="overflow-hidden rounded-lg border border-line" role="group" aria-label={label}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1 px-1.5 py-1">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => update(item.id, { enabled: e.target.checked })}
                aria-label={`Enable ${item.key || `row ${index + 1}`}`}
                className="mx-1 size-3.5 shrink-0 accent-[var(--accent)]"
              />
              <input
                value={item.key}
                onChange={(e) => update(item.id, { key: e.target.value })}
                placeholder={keyPlaceholder}
                aria-label={`${label} key ${index + 1}`}
                list={listId}
                className={`${cellInput} ${item.enabled ? '' : 'opacity-50'}`}
                spellCheck={false}
              />
              <input
                value={item.value}
                onChange={(e) => update(item.id, { value: e.target.value })}
                placeholder={valuePlaceholder}
                aria-label={`${label} value ${index + 1}`}
                className={`${cellInput} ${item.enabled ? '' : 'opacity-50'}`}
                spellCheck={false}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.key || `row ${index + 1}`}`}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => onChange([...items, createKeyValue()])}
        className="flex h-8 w-full items-center gap-1.5 border-t border-line bg-surface-2/40 px-3 text-xs font-medium text-muted transition-colors first:border-t-0 hover:bg-surface-2 hover:text-fg"
      >
        <Plus className="size-3.5" /> Add {label.toLowerCase().replace(/s$/, '')}
      </button>
      {suggestions && listId ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}
