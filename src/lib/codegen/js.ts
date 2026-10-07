import { INDEX_VARIABLE, parseTemplate, type Expression, type TemplateNode } from '../template'

/** Tracks which request-derived values a generated handler needs. */
export interface Uses {
  url: boolean
  body: boolean
  params: boolean
  request: boolean
  faker: boolean
}

export const emptyUses = (): Uses => ({
  url: false,
  body: false,
  params: false,
  request: false,
  faker: false,
})

const IDENT = /^[A-Za-z_$][\w$]*$/

export function propertyAccess(base: string, path: string[], optional = false): string {
  return path.reduce(
    (code, key) =>
      code +
      (IDENT.test(key)
        ? `${optional ? '?.' : '.'}${key}`
        : `${optional ? '?.' : ''}[${quoteJs(key)}]`),
    base,
  )
}

export function quoteJs(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
}

function literal(value: unknown): string {
  return typeof value === 'string' ? quoteJs(value) : JSON.stringify(value)
}

/** Request-derived values are strings; numeric helpers return numbers. */
type ExprKind = 'request-string' | 'number' | 'any'

export function expressionToJs(expr: Expression, uses: Uses): { code: string; kind: ExprKind } {
  const [root, ...rest] = expr.path
  const args = expr.args.map(literal).join(', ')
  let code: string
  let kind: ExprKind = 'any'
  switch (root) {
    case 'faker':
      uses.faker = true
      code = `${propertyAccess('faker', rest)}(${args})`
      break
    case 'params':
      uses.params = true
      code = rest.length ? propertyAccess('params', rest) : 'params'
      kind = 'request-string'
      break
    case 'query':
      uses.url = true
      uses.request = true
      code = `url.searchParams.get(${quoteJs(rest.join('.'))})`
      kind = 'request-string'
      break
    case 'headers':
      uses.request = true
      code = `request.headers.get(${quoteJs(rest.join('.'))})`
      kind = 'request-string'
      break
    case 'body':
      uses.body = true
      uses.request = true
      code = propertyAccess('body', rest, true)
      break
    case INDEX_VARIABLE:
      code = 'index'
      kind = 'number'
      break
    case 'uuid':
      code = 'crypto.randomUUID()'
      break
    case 'now':
      code = 'new Date().toISOString()'
      break
    case 'timestamp':
      code = 'Date.now()'
      kind = 'number'
      break
    case 'int': {
      uses.faker = true
      const [min = 0, max = 1000] = expr.args
      code = `faker.number.int({ min: ${String(min)}, max: ${String(max)} })`
      kind = 'number'
      break
    }
    case 'float': {
      uses.faker = true
      const [min = 0, max = 1000, digits = 2] = expr.args
      code = `faker.number.float({ min: ${String(min)}, max: ${String(max)}, fractionDigits: ${String(digits)} })`
      kind = 'number'
      break
    }
    case 'bool':
      uses.faker = true
      code = 'faker.datatype.boolean()'
      break
    case 'pick':
      uses.faker = true
      code = `faker.helpers.arrayElement([${args}])`
      break
    default:
      code = 'undefined'
  }
  if (expr.fallback !== undefined) code = `(${code} ?? ${literal(expr.fallback)})`
  return { code, kind }
}

/* ------------------------------------------------------------------ */
/* Template → JS value expression                                      */
/* ------------------------------------------------------------------ */

type Slot =
  | { type: 'raw'; expr: Expression }
  | { type: 'inline'; expr: Expression }
  | { type: 'repeat'; min: number; max: number; item: string }

const SENTINEL = /__MF(\d+)__/g
const EXACT_SENTINEL = /^__MF(\d+)__$/

class Unsupported extends Error {}

function skeleton(nodes: TemplateNode[], slots: Slot[]): string {
  let out = ''
  let inString = false
  for (const node of nodes) {
    if (node.type === 'text') {
      for (let i = 0; i < node.value.length; i++) {
        const ch = node.value[i]
        if (ch === '\\' && inString) {
          out += ch + (node.value[i + 1] ?? '')
          i++
          continue
        }
        if (ch === '"') inString = !inString
        out += ch
      }
    } else if (node.type === 'expr') {
      const id =
        slots.push(
          inString ? { type: 'inline', expr: node.expr } : { type: 'raw', expr: node.expr },
        ) - 1
      out += inString ? `__MF${id}__` : `"__MF${id}__"`
    } else {
      if (inString) throw new Unsupported('repeat inside a string')
      const item = skeleton(node.children, slots).replace(/,\s*$/, '')
      const id = slots.push({ type: 'repeat', min: node.min, max: node.max, item }) - 1
      out += `"__MF${id}__"`
    }
  }
  return out
}

interface Printer {
  slots: Slot[]
  uses: Uses
}

function indent(level: number) {
  return '  '.repeat(level)
}

/** Faker methods that return numeric strings (e.g. "42.00") but are used as JSON numbers. */
const NUMERIC_STRING_FAKERS = new Set(['commerce.price', 'finance.amount'])

function rawSlot(slot: Slot & { type: 'raw' }, p: Printer): string {
  const { code, kind } = expressionToJs(slot.expr, p.uses)
  const fakerPath = slot.expr.path[0] === 'faker' ? slot.expr.path.slice(1).join('.') : ''
  return kind === 'request-string' || NUMERIC_STRING_FAKERS.has(fakerPath)
    ? `Number(${code})`
    : code
}

function inlineString(value: string, p: Printer): string {
  const exact = EXACT_SENTINEL.exec(value)
  if (exact) {
    const slot = p.slots[Number(exact[1])]!
    if (slot.type !== 'inline') throw new Unsupported('unexpected slot')
    const { code, kind } = expressionToJs(slot.expr, p.uses)
    return kind === 'number' ? `String(${code})` : code
  }
  if (!/__MF\d+__/.test(value)) return quoteJs(value)
  const parts = value.split(SENTINEL)
  let out = '`'
  parts.forEach((part, i) => {
    if (i % 2 === 0)
      out += part.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    else {
      const slot = p.slots[Number(part)]!
      if (slot.type !== 'inline') throw new Unsupported('unexpected slot')
      out += `\${${expressionToJs(slot.expr, p.uses).code}}`
    }
  })
  return `${out}\``
}

function repeatCall(slot: Slot & { type: 'repeat' }, p: Printer, level: number): string {
  let item: unknown
  try {
    item = JSON.parse(slot.item)
  } catch {
    throw new Unsupported('repeat item is not a single JSON value')
  }
  const length =
    slot.min === slot.max
      ? String(slot.min)
      : ((p.uses.faker = true), `faker.number.int({ min: ${slot.min}, max: ${slot.max} })`)
  const body = printValue(item, p, level)
  const wrapped = body.startsWith('{') ? `(${body})` : body
  return `Array.from({ length: ${length} }, (_, index) => ${wrapped})`
}

function printValue(value: unknown, p: Printer, level: number): string {
  if (typeof value === 'string') {
    const exact = EXACT_SENTINEL.exec(value)
    if (exact) {
      const slot = p.slots[Number(exact[1])]!
      if (slot.type === 'raw') return rawSlot(slot, p)
      if (slot.type === 'repeat') throw new Unsupported('repeat outside of an array')
    }
    return inlineString(value, p)
  }
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const repeatOnly =
      value.length === 1 && typeof value[0] === 'string' && EXACT_SENTINEL.exec(value[0])
    if (repeatOnly) {
      const slot = p.slots[Number(repeatOnly[1])]!
      if (slot.type === 'repeat') return repeatCall(slot, p, level)
    }
    const items = value.map((item) => {
      const match = typeof item === 'string' ? EXACT_SENTINEL.exec(item) : null
      const slot = match ? p.slots[Number(match[1])] : undefined
      if (slot?.type === 'repeat') return `...${repeatCall(slot, p, level + 1)}`
      return printValue(item, p, level + 1)
    })
    return `[\n${items.map((i) => indent(level + 1) + i).join(',\n')},\n${indent(level)}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const lines = entries.map(
      ([key, v]) =>
        `${indent(level + 1)}${IDENT.test(key) ? key : quoteJs(key)}: ${printValue(v, p, level + 1)}`,
    )
    return `{\n${lines.join(',\n')},\n${indent(level)}}`
  }
  return JSON.stringify(value)
}

function textTemplate(nodes: TemplateNode[], uses: Uses): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text')
      out += node.value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    else if (node.type === 'expr') out += `\${${expressionToJs(node.expr, uses).code}}`
    else {
      const length =
        node.min === node.max
          ? String(node.min)
          : ((uses.faker = true), `faker.number.int({ min: ${node.min}, max: ${node.max} })`)
      out += `\${Array.from({ length: ${length} }, (_, index) => \`${textTemplate(node.children, uses).replace(/,\s*$/, '')}\`).join(',')}`
    }
  }
  return out
}

/** Compiles any template into a JS template literal producing identical text. */
export function compileText(source: string, uses: Uses): string {
  return `\`${textTemplate(parseTemplate(source), uses)}\``
}

export type CompiledBody =
  { kind: 'json'; code: string } | { kind: 'text'; code: string } | { kind: 'empty' }

/**
 * Compiles a response template into JavaScript. JSON templates become object
 * literals (`{ id: params.id, name: faker.person.fullName() }`); anything else
 * becomes a template literal producing identical text.
 */
export function compileTemplate(source: string, uses: Uses, level = 0): CompiledBody {
  if (!source.trim()) return { kind: 'empty' }
  const ast = parseTemplate(source)
  try {
    const slots: Slot[] = []
    const json: unknown = JSON.parse(skeleton(ast, slots))
    const scratch = { ...uses }
    const code = printValue(json, { slots, uses: scratch }, level)
    Object.assign(uses, scratch)
    return { kind: 'json', code }
  } catch (error) {
    if (!(error instanceof Unsupported) && !(error instanceof SyntaxError)) throw error
    return { kind: 'text', code: `\`${textTemplate(ast, uses)}\`` }
  }
}
