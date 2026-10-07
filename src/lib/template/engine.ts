import type { Faker } from '@faker-js/faker'
import {
  INDEX_VARIABLE,
  parseTemplate,
  TemplateSyntaxError,
  type Expression,
  type TemplateNode,
} from './ast'

export interface TemplateContext {
  params?: Record<string, string>
  query?: Record<string, string | string[]>
  body?: unknown
  headers?: Record<string, string>
}

export interface RenderOptions {
  faker: Faker
  /** `json` escapes string values so they are safe inside JSON string literals. */
  escape?: 'json' | 'none'
  now?: () => Date
}

export class TemplateRuntimeError extends Error {
  constructor(
    message: string,
    readonly from: number,
    readonly to: number,
  ) {
    super(message)
    this.name = 'TemplateRuntimeError'
  }
}

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])

function lookup(target: unknown, path: string[]): unknown {
  let value: unknown = target
  for (const segment of path) {
    if (value === null || value === undefined) return undefined
    if (FORBIDDEN.has(segment)) return undefined
    if (typeof value !== 'object' && typeof value !== 'function') return undefined
    const record = value as Record<string, unknown>
    value = record[segment]
  }
  return value
}

/** Case-insensitive header lookup. */
function lookupHeader(headers: Record<string, string> | undefined, name: string | undefined) {
  if (!headers || !name) return headers
  const lower = name.toLowerCase()
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower)
  return key ? headers[key] : undefined
}

export function resolveFaker(
  faker: Faker,
  path: string[],
): { fn: (...args: unknown[]) => unknown; owner: object } | null {
  let owner: unknown = faker
  let value: unknown = faker
  for (const segment of path) {
    if (FORBIDDEN.has(segment) || segment.startsWith('_')) return null
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return null
    owner = value
    value = (value as Record<string, unknown>)[segment]
  }
  if (typeof value !== 'function') return null
  return { fn: value as (...args: unknown[]) => unknown, owner: owner as object }
}

function evaluate(
  expr: Expression,
  ctx: TemplateContext,
  options: RenderOptions,
  scope: { index: number },
  node: { start: number; end: number },
): unknown {
  const [root, ...rest] = expr.path
  const { faker } = options
  const fail = (message: string): never => {
    throw new TemplateRuntimeError(message, node.start, node.end)
  }

  switch (root) {
    case 'faker': {
      const resolved = resolveFaker(faker, rest)
      if (!resolved) return fail(`faker.${rest.join('.')} is not a faker method`)
      try {
        return resolved.fn.apply(resolved.owner, expr.args)
      } catch (error) {
        return fail(`faker.${rest.join('.')} failed: ${(error as Error).message}`)
      }
    }
    case 'params':
      return lookup(ctx.params, rest)
    case 'query':
      return lookup(ctx.query, rest)
    case 'body':
      return lookup(ctx.body, rest)
    case 'headers':
      return rest.length ? lookupHeader(ctx.headers, rest.join('.')) : ctx.headers
    case INDEX_VARIABLE:
      return scope.index
    case 'uuid':
      return faker.string.uuid()
    case 'now':
      return (options.now?.() ?? new Date()).toISOString()
    case 'timestamp':
      return (options.now?.() ?? new Date()).getTime()
    case 'int': {
      const [min = 0, max = 1000] = expr.args as number[]
      return faker.number.int({ min: Number(min), max: Number(max) })
    }
    case 'float': {
      const [min = 0, max = 1000, digits = 2] = expr.args as number[]
      return faker.number.float({
        min: Number(min),
        max: Number(max),
        fractionDigits: Number(digits),
      })
    }
    case 'bool':
      return faker.datatype.boolean()
    case 'pick':
      if (!expr.args.length) return fail('pick needs at least one option: {{pick "a" "b"}}')
      return faker.helpers.arrayElement(expr.args)
    default:
      return fail(`Unknown variable "${root}"`)
  }
}

function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

function stringify(value: unknown, escape: 'json' | 'none'): string {
  if (value === undefined || value === null) return value === null ? 'null' : ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return escape === 'json' ? escapeJsonString(value) : value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value)
}

function renderNodes(
  nodes: TemplateNode[],
  ctx: TemplateContext,
  options: RenderOptions,
  scope: { index: number },
): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      out += node.value
    } else if (node.type === 'expr') {
      let value = evaluate(node.expr, ctx, options, scope, node)
      if ((value === undefined || value === '') && node.expr.fallback !== undefined) {
        value = node.expr.fallback
      }
      out += stringify(value, options.escape ?? 'json')
    } else {
      const count =
        node.min === node.max
          ? node.min
          : options.faker.number.int({ min: node.min, max: node.max })
      const items: string[] = []
      for (let i = 0; i < count; i++) {
        // Strip a trailing comma the author may have typed so the output stays valid JSON.
        items.push(renderNodes(node.children, ctx, options, { index: i }).replace(/,\s*$/, ''))
      }
      out += items.join(',')
    }
  }
  return out
}

export type RenderResult =
  { ok: true; output: string } | { ok: false; error: string; from: number; to: number }

export function renderTemplate(
  source: string,
  ctx: TemplateContext,
  options: RenderOptions,
): RenderResult {
  try {
    const ast = parseTemplate(source)
    return { ok: true, output: renderNodes(ast, ctx, options, { index: 0 }) }
  } catch (error) {
    if (error instanceof TemplateSyntaxError || error instanceof TemplateRuntimeError) {
      return { ok: false, error: error.message, from: error.from, to: error.to }
    }
    return { ok: false, error: (error as Error).message, from: 0, to: source.length }
  }
}

export function hasTemplateTags(source: string): boolean {
  return /\{\{[\s\S]*?\}\}/.test(source)
}
