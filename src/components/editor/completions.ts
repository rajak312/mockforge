import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { faker } from '@/lib/faker'

const SKIP_MODULES = new Set(['rawDefinitions', 'definitions'])

let fakerModules: Completion[] | null = null
const fakerMethods = new Map<string, Completion[]>()

function listFakerModules(): Completion[] {
  fakerModules ??= Object.keys(faker)
    .filter((key) => !key.startsWith('_') && !SKIP_MODULES.has(key))
    .filter((key) => {
      const value = (faker as unknown as Record<string, unknown>)[key]
      return typeof value === 'object' && value !== null
    })
    .sort()
    .map((key) => ({ label: key, type: 'namespace', detail: 'faker module' }))
  return fakerModules
}

function listFakerMethods(module: string): Completion[] {
  const cached = fakerMethods.get(module)
  if (cached) return cached
  const target = (faker as unknown as Record<string, unknown>)[module]
  if (!target || typeof target !== 'object') return []
  const names = new Set<string>()
  let proto: object | null = Object.getPrototypeOf(target) as object | null
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && !name.startsWith('_')) names.add(name)
    }
    proto = Object.getPrototypeOf(proto) as object | null
  }
  const items = [...names]
    .filter((name) => typeof (target as Record<string, unknown>)[name] === 'function')
    .sort()
    .map((name) => {
      let example = ''
      try {
        const value = ((target as Record<string, unknown>)[name] as () => unknown).call(target)
        example =
          value instanceof Date
            ? value.toISOString()
            : typeof value === 'object'
              ? ''
              : String(value)
      } catch {
        // some methods require arguments
      }
      return { label: name, type: 'function', detail: example.slice(0, 40) }
    })
  fakerMethods.set(module, items)
  return items
}

const ROOTS: Completion[] = [
  { label: 'faker.', type: 'namespace', detail: 'fake data', boost: 10 },
  { label: 'params.', type: 'variable', detail: 'path params', boost: 9 },
  { label: 'query.', type: 'variable', detail: 'query string', boost: 8 },
  { label: 'body.', type: 'variable', detail: 'request JSON body', boost: 8 },
  { label: 'headers.', type: 'variable', detail: 'request headers', boost: 7 },
  { label: 'uuid', type: 'function', detail: 'random UUID' },
  { label: 'now', type: 'function', detail: 'ISO timestamp' },
  { label: 'timestamp', type: 'function', detail: 'epoch millis' },
  { label: 'int 1 100', type: 'function', detail: 'random integer' },
  { label: 'float 0 100 2', type: 'function', detail: 'random decimal' },
  { label: 'bool', type: 'function', detail: 'random boolean' },
  { label: 'pick "a" "b"', type: 'function', detail: 'random choice' },
  { label: '@index', type: 'variable', detail: 'index inside repeat' },
]

export interface TemplateCompletionOptions {
  params: () => string[]
}

/** Autocompletes `{{…}}` tags: roots, faker modules/methods, path params and #repeat. */
export function templateCompletionSource(options: TemplateCompletionOptions) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\{\{[#/]?[\w.@-]*$/)
    if (!match) return null
    const inner = match.text.slice(2)
    const start = match.from + 2

    if (inner.startsWith('#') || inner.startsWith('/')) {
      return {
        from: start,
        options: [
          {
            label: '#repeat 5}}',
            type: 'keyword',
            detail: 'repeat block',
            apply: '#repeat 5}}\n  \n{{/repeat',
          },
          { label: '/repeat', type: 'keyword' },
        ],
      }
    }

    const lastDot = inner.lastIndexOf('.')
    if (lastDot === -1) {
      return { from: start, options: ROOTS, validFor: /^[\w@]*$/ }
    }
    const head = inner.slice(0, lastDot).split('.')
    const from = start + lastDot + 1
    if (head[0] === 'faker' && head.length === 1) {
      return {
        from,
        options: listFakerModules().map((o) => ({ ...o, apply: `${o.label}.` })),
        validFor: /^\w*$/,
      }
    }
    if (head[0] === 'faker' && head.length === 2) {
      return { from, options: listFakerMethods(head[1]!), validFor: /^\w*$/ }
    }
    if (head[0] === 'params' && head.length === 1) {
      return {
        from,
        options: options
          .params()
          .map((p) => ({ label: p, type: 'variable', detail: 'path param' })),
      }
    }
    if (head[0] === 'query' && head.length === 1) {
      return {
        from,
        options: ['page', 'limit', 'q', 'sort'].map((p) => ({
          label: p,
          type: 'variable',
          detail: 'query param',
        })),
      }
    }
    if (head[0] === 'headers' && head.length === 1) {
      return {
        from,
        options: ['authorization', 'content-type', 'accept', 'user-agent'].map((p) => ({
          label: p,
          type: 'variable',
        })),
      }
    }
    return null
  }
}
