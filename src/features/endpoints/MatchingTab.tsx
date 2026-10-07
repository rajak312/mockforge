import { Plus, X } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { createId } from '@/lib/id'
import type {
  Collection,
  Endpoint,
  MatchRule,
  QueryMatcher,
  RuleOperator,
  RuleSource,
  VariantSelection,
} from '@/lib/types'
import { useWorkspace } from '@/store/workspace'

const SOURCES: { value: RuleSource; label: string }[] = [
  { value: 'param', label: 'Path param' },
  { value: 'query', label: 'Query param' },
  { value: 'header', label: 'Header' },
  { value: 'body', label: 'Body field' },
]

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
  { value: 'regex', label: 'matches regex' },
]

const cell =
  'h-8 min-w-0 rounded-md border border-line bg-surface px-2 text-[12.5px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15'

function SelectionCard({
  value,
  current,
  title,
  description,
  onSelect,
}: {
  value: VariantSelection
  current: VariantSelection
  title: string
  description: string
  onSelect: (value: VariantSelection) => void
}) {
  const checked = value === current
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
        checked ? 'border-accent/50 bg-accent-soft/50' : 'border-line hover:border-line-strong',
      )}
    >
      <input
        type="radio"
        name="selection"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
    </label>
  )
}

export function MatchingTab({
  collection,
  endpoint,
}: {
  collection: Collection
  endpoint: Endpoint
}) {
  const { updateEndpoint, updateVariant } = useWorkspace()
  const setQuery = (query: QueryMatcher[]) => updateEndpoint(collection.id, endpoint.id, { query })
  const setRules = (variantId: string, rules: MatchRule[]) =>
    updateVariant(collection.id, endpoint.id, variantId, { rules })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <section aria-labelledby="query-heading">
          <h3 id="query-heading" className="text-sm font-semibold">
            Query matching
          </h3>
          <p className="mt-1 text-xs text-muted">
            Only serve this endpoint when the request has these query parameters. Leave the value
            empty to require presence only. Endpoints with more query matchers win over generic ones
            on the same path.
          </p>
          <div className="mt-3 space-y-2">
            {endpoint.query.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2">
                <input
                  className={cn(cell, 'flex-1 font-mono')}
                  value={q.key}
                  placeholder="param"
                  aria-label={`Query matcher ${i + 1} name`}
                  onChange={(e) =>
                    setQuery(
                      endpoint.query.map((x) =>
                        x.id === q.id ? { ...x, key: e.target.value } : x,
                      ),
                    )
                  }
                />
                <span className="text-xs text-subtle">=</span>
                <input
                  className={cn(cell, 'flex-1 font-mono')}
                  value={q.value}
                  placeholder="any value"
                  aria-label={`Query matcher ${i + 1} value`}
                  onChange={(e) =>
                    setQuery(
                      endpoint.query.map((x) =>
                        x.id === q.id ? { ...x, value: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove query matcher"
                  onClick={() => setQuery(endpoint.query.filter((x) => x.id !== q.id))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQuery([...endpoint.query, { id: createId(), key: '', value: '' }])}
            >
              <Plus /> Add query matcher
            </Button>
          </div>
        </section>

        <section aria-labelledby="selection-heading">
          <h3 id="selection-heading" className="text-sm font-semibold">
            Response selection
          </h3>
          <div
            className="mt-3 grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-labelledby="selection-heading"
          >
            <SelectionCard
              value="active"
              current={endpoint.selection}
              title="Always the active response"
              description="Toggle the starred response to switch scenarios by hand."
              onSelect={(selection) => updateEndpoint(collection.id, endpoint.id, { selection })}
            />
            <SelectionCard
              value="rules"
              current={endpoint.selection}
              title="Rule-based"
              description="The first response whose rules all match wins. The active one is the fallback."
              onSelect={(selection) => updateEndpoint(collection.id, endpoint.id, { selection })}
            />
          </div>
        </section>

        {endpoint.selection === 'rules' ? (
          <section aria-label="Rules per response" className="space-y-3">
            {endpoint.variants.map((variant) => {
              const fallback = variant.id === endpoint.activeVariantId
              return (
                <div key={variant.id} className="rounded-xl border border-line">
                  <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                    <StatusBadge status={variant.status} />
                    <span className="text-sm font-medium">{variant.name}</span>
                    {fallback ? (
                      <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">
                        Fallback — used when nothing else matches
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-2 p-3">
                    {variant.rules.length === 0 && !fallback ? (
                      <p className="px-1 text-xs text-subtle">
                        No rules — this response is never selected automatically.
                      </p>
                    ) : null}
                    {variant.rules.map((rule, i) => {
                      const patch = (p: Partial<MatchRule>) =>
                        setRules(
                          variant.id,
                          variant.rules.map((r) => (r.id === rule.id ? { ...r, ...p } : r)),
                        )
                      return (
                        <div
                          key={rule.id}
                          className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                        >
                          <span className="w-8 text-right text-[11px] text-subtle">
                            {i === 0 ? 'if' : 'and'}
                          </span>
                          <select
                            className={cn(cell, 'w-32')}
                            value={rule.source}
                            aria-label="Rule source"
                            onChange={(e) => patch({ source: e.target.value as RuleSource })}
                          >
                            {SOURCES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className={cn(cell, 'w-32 flex-1 font-mono')}
                            value={rule.key}
                            placeholder={
                              rule.source === 'body'
                                ? 'user.email'
                                : rule.source === 'header'
                                  ? 'Authorization'
                                  : 'id'
                            }
                            aria-label="Rule key"
                            onChange={(e) => patch({ key: e.target.value })}
                          />
                          <select
                            className={cn(cell, 'w-36')}
                            value={rule.operator}
                            aria-label="Rule operator"
                            onChange={(e) => patch({ operator: e.target.value as RuleOperator })}
                          >
                            {OPERATORS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {rule.operator !== 'exists' ? (
                            <input
                              className={cn(cell, 'w-32 flex-1 font-mono')}
                              value={rule.value}
                              placeholder="value"
                              aria-label="Rule value"
                              onChange={(e) => patch({ value: e.target.value })}
                            />
                          ) : (
                            <span className="flex-1" />
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove rule"
                            onClick={() =>
                              setRules(
                                variant.id,
                                variant.rules.filter((r) => r.id !== rule.id),
                              )
                            }
                          >
                            <X />
                          </Button>
                        </div>
                      )
                    })}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setRules(variant.id, [
                          ...variant.rules,
                          {
                            id: createId(),
                            source: 'query',
                            key: '',
                            operator: 'equals',
                            value: '',
                          },
                        ])
                      }
                    >
                      <Plus /> Add rule
                    </Button>
                  </div>
                </div>
              )
            })}
          </section>
        ) : null}
      </div>
    </div>
  )
}
