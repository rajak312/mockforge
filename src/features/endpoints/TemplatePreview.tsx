import { CircleCheck, CircleX, Shuffle } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { Button } from '@/components/ui/Button'
import { formatBytes } from '@/lib/http'
import type { TemplateContext } from '@/lib/template'
import { renderPreview } from './template-tools'

/** Live rendering of a response template against an editable sample request. */
export function TemplatePreview({
  template,
  expectJson,
  paramNames,
  usesBody,
}: {
  template: string
  expectJson: boolean
  paramNames: string[]
  usesBody: boolean
}) {
  const [params, setParams] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('page=2')
  const [body, setBody] = useState('{"email": "ada@example.com"}')
  const [seed, setSeed] = useState(7)
  const deferredTemplate = useDeferredValue(template)

  const ctx = useMemo<TemplateContext>(() => {
    let parsedBody: unknown
    try {
      parsedBody = body ? JSON.parse(body) : undefined
    } catch {
      parsedBody = undefined
    }
    return {
      params: Object.fromEntries(
        paramNames.map((p) => [p, params[p] ?? (/id$/i.test(p) ? '1' : 'sample')]),
      ),
      query: Object.fromEntries(new URLSearchParams(query)),
      body: parsedBody,
      headers: { authorization: 'Bearer demo-token', 'content-type': 'application/json' },
    }
  }, [paramNames, params, query, body])

  const result = useMemo(
    () => renderPreview(deferredTemplate, ctx, seed, expectJson),
    [deferredTemplate, ctx, seed, expectJson],
  )

  const inputClass =
    'h-7 w-full min-w-0 rounded-md border border-line bg-surface px-2 font-mono text-[12px] focus:border-accent focus:outline-none'

  return (
    <section className="flex min-h-0 flex-col" aria-label="Live preview">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Preview</h3>
        <span className="text-[11px] text-subtle">sample request</span>
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto"
          onClick={() => setSeed((s) => s + 1)}
          title="Re-roll random data"
        >
          <Shuffle /> Shuffle data
        </Button>
      </div>
      <div className="grid gap-2 border-b border-line bg-surface-2/40 px-3 py-2.5 text-[11px] sm:grid-cols-2">
        {paramNames.map((name) => (
          <label key={name} className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate font-mono text-subtle">:{name}</span>
            <input
              className={inputClass}
              value={params[name] ?? (/id$/i.test(name) ? '1' : 'sample')}
              onChange={(e) => setParams((p) => ({ ...p, [name]: e.target.value }))}
              aria-label={`Sample value for path param ${name}`}
            />
          </label>
        ))}
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 font-mono text-subtle">?query</span>
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Sample query string"
          />
        </label>
        {usesBody ? (
          <label className="flex items-center gap-2 sm:col-span-2">
            <span className="w-14 shrink-0 font-mono text-subtle">body</span>
            <input
              className={inputClass}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Sample JSON request body"
            />
          </label>
        ) : null}
      </div>
      <CodeEditor
        value={result.output}
        readOnly
        language={expectJson ? 'json' : 'text'}
        ariaLabel="Rendered response preview"
        className="min-h-40 flex-1"
        placeholder="Empty body"
      />
      <div
        role="status"
        className={`flex items-center gap-2 border-t px-3 py-1.5 text-[11.5px] ${
          result.ok
            ? 'border-line text-muted'
            : 'border-rose-500/30 bg-rose-500/8 text-rose-700 dark:text-rose-300'
        }`}
      >
        {result.ok ? (
          <>
            <CircleCheck className="size-3.5 text-emerald-500" />
            {expectJson ? 'Valid JSON' : 'Rendered'} · {formatBytes(result.bytes)} ·{' '}
            {result.ms.toFixed(1)} ms
          </>
        ) : (
          <>
            <CircleX className="size-3.5 shrink-0" />
            <span className="truncate" title={result.message}>
              {result.line ? `Line ${result.line}: ` : ''}
              {result.message}
            </span>
          </>
        )}
      </div>
    </section>
  )
}
