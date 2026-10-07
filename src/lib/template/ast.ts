/**
 * Template syntax (a small, JSON-friendly subset of Handlebars):
 *
 *   {{faker.person.fullName}}           call a faker method
 *   {{faker.number.int({"max": 99})}}   call with JSON arguments
 *   {{params.id}} {{query.page}}        request data (also body.*, headers.*)
 *   {{query.limit ?? 10}}               fallback when the value is missing
 *   {{uuid}} {{now}} {{timestamp}}      built-in helpers
 *   {{int 1 100}} {{pick "a" "b"}}      helpers with space separated literal args
 *   {{#repeat 10}}…{{/repeat}}          repeat a block, comma separated (JSON arrays)
 *   {{#repeat 2 5}}…{{/repeat}}         repeat a random number of times
 *   {{@index}}                          zero-based index inside repeat
 */

export type Literal = string | number | boolean | null

export interface Expression {
  /** Dot path, e.g. `faker.person.fullName`, `params.id`, `uuid`. */
  path: string[]
  /** Arguments passed via `(…)` (JSON) or space separated literals. */
  args: unknown[]
  /** `true` when written with parentheses: `faker.number.int()` */
  explicitCall: boolean
  fallback?: Literal
}

export interface TextNode {
  type: 'text'
  value: string
  start: number
  end: number
}

export interface ExpressionNode {
  type: 'expr'
  expr: Expression
  raw: string
  start: number
  end: number
}

export interface RepeatNode {
  type: 'repeat'
  min: number
  max: number
  children: TemplateNode[]
  start: number
  end: number
}

export type TemplateNode = TextNode | ExpressionNode | RepeatNode

export class TemplateSyntaxError extends Error {
  constructor(
    message: string,
    readonly from: number,
    readonly to: number,
  ) {
    super(message)
    this.name = 'TemplateSyntaxError'
  }
}

export const HELPERS = ['uuid', 'now', 'timestamp', 'int', 'float', 'pick', 'bool'] as const
export const CONTEXT_ROOTS = ['params', 'query', 'body', 'headers'] as const
export const INDEX_VARIABLE = '@index'
export const MAX_REPEAT = 1000

const KNOWN_ROOTS = new Set<string>(['faker', INDEX_VARIABLE, ...HELPERS, ...CONTEXT_ROOTS])
const PATH_RE = /^(@?[A-Za-z_$][\w$]*(?:\.[\w$-]+)*)/

function parseLiteral(token: string): Literal | undefined {
  const t = token.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.length >= 2 ? t.slice(1, -1) : undefined
  }
  return undefined
}

/** Splits `a "b c" 3` into literal tokens, respecting quotes. */
function splitArgs(input: string): string[] {
  const tokens: string[] = []
  const re = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) tokens.push(m[0])
  return tokens
}

function findTopLevel(source: string, needle: string): number {
  let quote: string | null = null
  let depth = 0
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (depth === 0 && source.startsWith(needle, i)) return i
  }
  return -1
}

export function parseExpression(source: string, offset = 0): Expression {
  const fail = (message: string): never => {
    throw new TemplateSyntaxError(message, offset, offset + source.length)
  }
  let body = source.trim()
  if (!body) fail('Empty expression')

  let fallback: Literal | undefined
  const fallbackAt = findTopLevel(body, '??')
  if (fallbackAt !== -1) {
    const rawFallback = body.slice(fallbackAt + 2).trim()
    fallback = parseLiteral(rawFallback)
    if (fallback === undefined)
      fail(`Fallback must be a literal (number, "string", true/false/null)`)
    body = body.slice(0, fallbackAt).trim()
  }

  const pathMatch = PATH_RE.exec(body)
  if (!pathMatch) return fail(`Invalid expression "${body}"`)
  const pathText = pathMatch[1]!
  const path = pathText.split('.')
  let rest = body.slice(pathText.length)
  let args: unknown[] = []
  let explicitCall = false

  if (rest.startsWith('(')) {
    if (!rest.endsWith(')')) fail('Missing closing parenthesis')
    explicitCall = true
    const inner = rest.slice(1, -1).trim()
    if (inner) {
      try {
        args = JSON.parse(`[${inner}]`) as unknown[]
      } catch {
        fail('Arguments must be valid JSON, e.g. faker.number.int({"min": 1, "max": 10})')
      }
    }
    rest = ''
  }

  rest = rest.trim()
  if (rest) {
    args = splitArgs(rest).map((token) => {
      const value = parseLiteral(token)
      if (value === undefined) fail(`Invalid argument ${token}. Quote strings: "${token}"`)
      return value
    })
  }

  const root = path[0]!
  if (!KNOWN_ROOTS.has(root)) {
    fail(
      `Unknown variable "${root}". Use faker.*, params.*, query.*, body.*, headers.*, @index or a helper (${HELPERS.join(', ')})`,
    )
  }
  if (path.some((segment) => ['__proto__', 'prototype', 'constructor'].includes(segment))) {
    fail('Forbidden property access')
  }
  if (root === 'faker' && path.length < 2)
    fail('Specify a faker method, e.g. faker.person.fullName')

  return { path, args, explicitCall, ...(fallback !== undefined ? { fallback } : {}) }
}

const TAG_RE = /\{\{([\s\S]*?)\}\}/g

/** Parses a template into an AST. Throws {@link TemplateSyntaxError} with source offsets. */
export function parseTemplate(source: string): TemplateNode[] {
  const root: TemplateNode[] = []
  const stack: { node: RepeatNode; openEnd: number }[] = []
  const current = () => (stack.length ? stack[stack.length - 1]!.node.children : root)

  let cursor = 0
  TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(source))) {
    const start = match.index
    const end = start + match[0].length
    const inner = match[1]!
    const innerOffset = start + 2

    if (start > cursor)
      current().push({
        type: 'text',
        value: source.slice(cursor, start),
        start: cursor,
        end: start,
      })
    cursor = end

    const trimmed = inner.trim()
    if (trimmed.startsWith('!')) continue // comment

    if (trimmed.startsWith('#')) {
      const [keyword, ...rawArgs] = trimmed.slice(1).trim().split(/\s+/)
      if (keyword !== 'repeat') {
        throw new TemplateSyntaxError(
          `Unknown block helper "#${keyword}". Only #repeat is supported`,
          start,
          end,
        )
      }
      const nums = rawArgs.map(Number)
      if (nums.length === 0 || nums.length > 2 || nums.some((n) => !Number.isInteger(n) || n < 0)) {
        throw new TemplateSyntaxError('Usage: {{#repeat 10}} or {{#repeat 2 5}}', start, end)
      }
      const min = nums[0]!
      const max = nums[1] ?? min
      if (max < min) throw new TemplateSyntaxError('repeat: max must be ≥ min', start, end)
      if (max > MAX_REPEAT)
        throw new TemplateSyntaxError(`repeat: at most ${MAX_REPEAT} items`, start, end)
      const node: RepeatNode = { type: 'repeat', min, max, children: [], start, end }
      current().push(node)
      stack.push({ node, openEnd: end })
      continue
    }

    if (trimmed.startsWith('/')) {
      const keyword = trimmed.slice(1).trim()
      const open = stack.pop()
      if (!open)
        throw new TemplateSyntaxError(
          `Unexpected {{/${keyword}}} without an opening block`,
          start,
          end,
        )
      if (keyword !== 'repeat') throw new TemplateSyntaxError(`Expected {{/repeat}}`, start, end)
      open.node.end = end
      continue
    }

    if (inner.includes('{{')) throw new TemplateSyntaxError('Nested "{{" inside a tag', start, end)
    const leading = inner.length - inner.trimStart().length
    current().push({
      type: 'expr',
      expr: parseExpression(trimmed, innerOffset + leading),
      raw: match[0],
      start,
      end,
    })
  }

  const unclosedOpen = source.indexOf('{{', cursor)
  if (unclosedOpen !== -1) {
    throw new TemplateSyntaxError('Unclosed tag: missing "}}"', unclosedOpen, source.length)
  }
  if (cursor < source.length)
    current().push({ type: 'text', value: source.slice(cursor), start: cursor, end: source.length })

  const unclosed = stack.pop()
  if (unclosed) {
    throw new TemplateSyntaxError(
      'Unclosed {{#repeat}} block: add {{/repeat}}',
      unclosed.node.start,
      unclosed.openEnd,
    )
  }
  return root
}
