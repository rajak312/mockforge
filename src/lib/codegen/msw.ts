import { isNullBodyStatus } from '../http'
import { joinUrl } from '../path-match'
import type { Collection, CrudResource, Endpoint, MatchRule, ResponseVariant } from '../types'
import { compileTemplate, compileText, emptyUses, propertyAccess, quoteJs, type Uses } from './js'

const I = '  '

function indentBlock(code: string, level: number): string {
  const pad = I.repeat(level)
  return code
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n')
}

function headersObject(variant: ResponseVariant, skipContentType: boolean): string | null {
  const entries = variant.headers
    .filter((h) => h.enabled && h.key.trim())
    .filter(
      (h) =>
        !(skipContentType && h.key.toLowerCase() === 'content-type' && h.value.includes('json')),
    )
    .map((h) => `${quoteJs(h.key.trim())}: ${quoteJs(h.value)}`)
  return entries.length ? `{ ${entries.join(', ')} }` : null
}

function contentType(variant: ResponseVariant): string {
  return (
    variant.headers.find((h) => h.enabled && h.key.toLowerCase() === 'content-type')?.value ?? ''
  )
}

function responseInit(status: number, headers: string | null): string {
  const parts = [`status: ${status}`]
  if (headers) parts.push(`headers: ${headers}`)
  return status === 200 && !headers ? '' : `, { ${parts.join(', ')} }`
}

/** Builds the `return …` statement (plus optional delay) for one variant. */
function variantReturn(variant: ResponseVariant, uses: Uses): string {
  const lines: string[] = []
  if (variant.delay > 0) lines.push(`await delay(${variant.delay})`)
  const type = contentType(variant)
  const isJson = type.includes('json') || !type

  if (isNullBodyStatus(variant.status) || !variant.body.trim()) {
    const headers = headersObject(variant, true)
    lines.push(
      `return new HttpResponse(null, { status: ${variant.status}${headers ? `, headers: ${headers}` : ''} })`,
    )
    return lines.join('\n')
  }

  const compiled = isJson ? compileTemplate(variant.body, uses) : null
  if (compiled?.kind === 'json') {
    lines.push(
      `return HttpResponse.json(${compiled.code}${responseInit(variant.status, headersObject(variant, true))})`,
    )
    return lines.join('\n')
  }
  const textCode = compiled?.kind === 'text' ? compiled.code : compileText(variant.body, uses)
  const headers =
    headersObject(variant, false) ?? `{ 'Content-Type': ${quoteJs(type || 'text/plain')} }`
  lines.push(
    `return new HttpResponse(${textCode}, { status: ${variant.status}, headers: ${headers} })`,
  )
  return lines.join('\n')
}

function ruleCondition(rule: MatchRule, uses: Uses): string {
  let subject: string
  switch (rule.source) {
    case 'param':
      uses.params = true
      subject = propertyAccess('params', [rule.key])
      break
    case 'query':
      uses.url = true
      uses.request = true
      subject = `url.searchParams.get(${quoteJs(rule.key)})`
      break
    case 'header':
      uses.request = true
      subject = `request.headers.get(${quoteJs(rule.key)})`
      break
    case 'body':
      uses.body = true
      uses.request = true
      subject = propertyAccess('body', rule.key.split('.'), true)
      break
  }
  const value = quoteJs(rule.value)
  switch (rule.operator) {
    case 'exists':
      return `${subject} != null`
    case 'equals':
      return rule.source === 'body' ? `String(${subject}) === ${value}` : `${subject} === ${value}`
    case 'notEquals':
      return rule.source === 'body' ? `String(${subject}) !== ${value}` : `${subject} !== ${value}`
    case 'contains':
      return `String(${subject} ?? '').includes(${value})`
    case 'regex':
      return `/${rule.value.replace(/\//g, '\\/')}/.test(String(${subject} ?? ''))`
  }
}

function resolverSignature(uses: Uses): string {
  const args = [uses.request ? 'request' : '', uses.params ? 'params' : ''].filter(Boolean)
  return args.length ? `{ ${args.join(', ')} }` : ''
}

function preamble(uses: Uses): string[] {
  const lines: string[] = []
  if (uses.url) lines.push('const url = new URL(request.url)')
  if (uses.body) {
    lines.push(
      'const body = (await request.clone().json().catch(() => null)) as Record<string, any> | null',
    )
  }
  return lines
}

function camel(name: string): string {
  const id = name.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) =>
    c ? c.toUpperCase() : '',
  )
  return /^[A-Za-z_$]/.test(id) ? id : `_${id}`
}

function crudBody(endpoint: Endpoint, resource: CrudResource, uses: Uses): string[] {
  const table = `db.${camel(resource.name)}`
  const id = resource.idField
  const findIndex = `${table}.findIndex((item) => String(item[${quoteJs(id)}]) === params[${quoteJs(id)}])`
  const notFound = `return HttpResponse.json({ error: 'Not Found' }, { status: 404 })`
  uses.params =
    endpoint.crud!.action !== 'list' && endpoint.crud!.action !== 'create' ? true : uses.params
  switch (endpoint.crud!.action) {
    case 'list':
      uses.url = true
      uses.request = true
      return [
        `const page = Number(url.searchParams.get('page') ?? 1)`,
        `const limit = Number(url.searchParams.get('limit') ?? 20)`,
        `const data = ${table}.slice((page - 1) * limit, page * limit)`,
        `return HttpResponse.json({ data, meta: { total: ${table}.length, page, limit } })`,
      ]
    case 'get':
      return [
        `const item = ${table}.find((item) => String(item[${quoteJs(id)}]) === params[${quoteJs(id)}])`,
        `if (!item) ${notFound}`,
        'return HttpResponse.json(item)',
      ]
    case 'create':
      uses.request = true
      return [
        `const input = (await request.json()) as Record<string, unknown>`,
        `const item = { ${id}: ${table}.length + 1, ...input }`,
        `${table}.push(item)`,
        'return HttpResponse.json(item, { status: 201 })',
      ]
    case 'update': {
      uses.request = true
      const merge = endpoint.method === 'PATCH'
      return [
        `const index = ${findIndex}`,
        `if (index === -1) ${notFound}`,
        `const input = (await request.json()) as Record<string, unknown>`,
        merge
          ? `${table}[index] = { ...${table}[index], ...input, ${id}: ${table}[index]![${quoteJs(id)}] }`
          : `${table}[index] = { ...input, ${id}: ${table}[index]![${quoteJs(id)}] }`,
        `return HttpResponse.json(${table}[index])`,
      ]
    }
    case 'delete':
      return [
        `const index = ${findIndex}`,
        `if (index === -1) ${notFound}`,
        `${table}.splice(index, 1)`,
        'return new HttpResponse(null, { status: 204 })',
      ]
  }
}

export interface GeneratedHandler {
  code: string
  uses: Uses
}

/** Generates a single `http.<method>(…)` handler expression. */
export function generateHandler(collection: Collection, endpoint: Endpoint): GeneratedHandler {
  const uses = emptyUses()
  const url = joinUrl(collection.baseUrl, endpoint.path)
  const statements: string[] = []

  for (const matcher of endpoint.query.filter((q) => q.key)) {
    uses.url = true
    uses.request = true
    const get = `url.searchParams.get(${quoteJs(matcher.key)})`
    statements.push(
      matcher.value
        ? `if (${get} !== ${quoteJs(matcher.value)}) return // fall through to the next handler`
        : `if (${get} === null) return // fall through to the next handler`,
    )
  }

  const active =
    endpoint.variants.find((v) => v.id === endpoint.activeVariantId) ?? endpoint.variants[0]
  const resource = endpoint.crud
    ? collection.resources.find((r) => r.id === endpoint.crud!.resourceId)
    : undefined

  if (endpoint.selection === 'rules') {
    for (const variant of endpoint.variants.filter((v) => v.rules.length && v !== active)) {
      const condition = variant.rules.map((rule) => ruleCondition(rule, uses)).join(' && ')
      statements.push(
        `// ${variant.name}\nif (${condition}) {\n${indentBlock(variantReturn(variant, uses), 1)}\n}`,
      )
    }
  }

  if (active?.fromStore && resource) {
    if (active.delay > 0) statements.push(`await delay(${active.delay})`)
    statements.push(...crudBody(endpoint, resource, uses))
  } else if (active) {
    statements.push(variantReturn(active, uses))
  }

  const body = [...preamble(uses), ...statements].join('\n')
  const isAsync = /\bawait\b/.test(body)
  const method = endpoint.method.toLowerCase()
  const comment = endpoint.name ? `// ${endpoint.name}\n` : ''
  const code = `${comment}http.${method}(${quoteJs(url)}, ${isAsync ? 'async ' : ''}(${resolverSignature(uses)}) => {\n${indentBlock(body, 1)}\n})`
  return { code, uses }
}

function recordFactory(resource: CrudResource, uses: Uses): string {
  const compiled = compileTemplate(resource.recordTemplate, uses, 0)
  if (compiled.kind === 'json' && compiled.code.startsWith('{')) {
    return `{\n  ${resource.idField}: index + 1,${compiled.code.slice(1)}`
  }
  return `({ ${resource.idField}: index + 1, ...JSON.parse(${compiled.kind === 'empty' ? "'{}'" : compiled.code}) })`
}

/** Generates a complete, ready-to-paste `handlers.ts` module for a collection. */
export function generateHandlersFile(collection: Collection): string {
  const handlers: string[] = []
  const all = emptyUses()
  const merge = (u: Uses) => {
    for (const key of Object.keys(all) as (keyof Uses)[]) all[key] ||= u[key]
  }

  const resources = collection.resources.filter((resource) =>
    collection.endpoints.some((e) => e.enabled && e.crud?.resourceId === resource.id),
  )
  let dbBlock = ''
  if (resources.length) {
    const rows = resources.map((resource) => {
      const uses = emptyUses()
      const factory = recordFactory(resource, uses)
      merge(uses)
      const call = factory.startsWith('{') ? `(${factory})` : factory
      return `  ${camel(resource.name)}: Array.from({ length: ${resource.seedCount} }, (_, index) => ${call.replace(/\n/g, '\n  ')}) as Record<string, unknown>[],`
    })
    dbBlock = `/** In-memory tables backing the stateful CRUD endpoints. */\nconst db = {\n${rows.join('\n')}\n}\n\n`
  }

  for (const endpoint of collection.endpoints) {
    if (!endpoint.enabled) {
      handlers.push(`// (disabled) ${endpoint.method} ${endpoint.path}`)
      continue
    }
    const { code, uses } = generateHandler(collection, endpoint)
    merge(uses)
    handlers.push(`${code},`)
  }

  const mswImports = ['http', 'HttpResponse']
  const allCode = handlers.join('\n')
  if (/\bdelay\(/.test(allCode)) mswImports.unshift('delay')
  const imports = [`import { ${mswImports.join(', ')} } from 'msw'`]
  if (all.faker) imports.push(`import { faker } from '@faker-js/faker'`)

  return `${imports.join('\n')}

/**
 * MSW request handlers for "${collection.name.replace(/\*\//g, '* /')}".
 * Generated by MockForge — https://github.com/lalitkumarrajak/mockforge
 *
 * Browser:  setupWorker(...handlers).start()   (msw/browser)
 * Node:     setupServer(...handlers).listen()  (msw/node)
 */
${dbBlock}export const handlers = [
${indentBlock(allCode, 1)}
]
`
}
