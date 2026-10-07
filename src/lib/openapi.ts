import { parse as parseYaml } from 'yaml'
import { createCollection, createEndpoint, createKeyValue, createVariant } from './factory'
import { slugify } from './id'
import { extractParamNames, fromOpenApiPath } from './path-match'
import {
  HTTP_METHODS,
  type Collection,
  type Endpoint,
  type HttpMethod,
  type ResponseVariant,
} from './types'

/* Minimal structural types — OpenAPI documents are untrusted input, so everything is optional. */
type Json = unknown
interface Schema {
  $ref?: string
  type?: string | string[]
  format?: string
  enum?: Json[]
  example?: Json
  examples?: Json[]
  default?: Json
  properties?: Record<string, Schema>
  items?: Schema
  allOf?: Schema[]
  oneOf?: Schema[]
  anyOf?: Schema[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  nullable?: boolean
}
interface MediaType {
  schema?: Schema
  example?: Json
  examples?: Record<string, { value?: Json; $ref?: string }>
}
interface ResponseObject {
  $ref?: string
  description?: string
  content?: Record<string, MediaType>
  headers?: Record<string, unknown>
}
interface Operation {
  operationId?: string
  summary?: string
  description?: string
  responses?: Record<string, ResponseObject>
}
interface OpenApiDocument {
  openapi?: string
  swagger?: string
  info?: { title?: string; description?: string; version?: string }
  servers?: { url?: string }[]
  paths?: Record<string, Record<string, Operation | unknown>>
  components?: Record<string, unknown>
}

export interface OpenApiImportResult {
  collection: Collection
  warnings: string[]
}

export class OpenApiImportError extends Error {
  override name = 'OpenApiImportError'
}

/** Parses JSON or YAML text into an object. */
export function parseSpecText(text: string): OpenApiDocument {
  const trimmed = text.trim()
  if (!trimmed) throw new OpenApiImportError('The spec is empty')
  let doc: unknown
  try {
    doc = trimmed.startsWith('{') ? JSON.parse(trimmed) : parseYaml(trimmed)
  } catch (error) {
    throw new OpenApiImportError(`Could not parse spec: ${(error as Error).message.split('\n')[0]}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new OpenApiImportError('The spec must be a JSON or YAML object')
  }
  return doc as OpenApiDocument
}

function resolvePointer(root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      root,
    )
}

/* ------------------------------------------------------------------ */
/* Schema → template                                                   */
/* ------------------------------------------------------------------ */

const STRING_FORMATS: Record<string, string> = {
  email: '{{faker.internet.email}}',
  uuid: '{{uuid}}',
  'date-time': '{{faker.date.recent}}',
  date: '{{faker.date.past}}',
  uri: '{{faker.internet.url}}',
  url: '{{faker.internet.url}}',
  hostname: '{{faker.internet.domainName}}',
  ipv4: '{{faker.internet.ipv4}}',
  ipv6: '{{faker.internet.ipv6}}',
  password: '{{faker.internet.password}}',
  byte: '{{faker.string.alphanumeric(16)}}',
}

/** Property-name heuristics, checked in order against the lower-cased name. */
const NAME_HINTS: [RegExp, string][] = [
  [/^(full_?name|name|display_?name|author|customer)$/, '{{faker.person.fullName}}'],
  [/^first_?name$/, '{{faker.person.firstName}}'],
  [/^last_?name$/, '{{faker.person.lastName}}'],
  [/^(user_?name|login|handle)$/, '{{faker.internet.username}}'],
  [/e_?mail/, '{{faker.internet.email}}'],
  [/phone|mobile/, '{{faker.phone.number}}'],
  [/avatar/, '{{faker.image.avatar}}'],
  [/(image|photo|picture|thumbnail)(_?url)?$/, '{{faker.image.url}}'],
  [/(url|website|homepage|link)$/, '{{faker.internet.url}}'],
  [/^city$/, '{{faker.location.city}}'],
  [/^country$/, '{{faker.location.country}}'],
  [/^(street|address|address_?line1?)$/, '{{faker.location.streetAddress}}'],
  [/^(zip|zip_?code|postal_?code|postcode)$/, '{{faker.location.zipCode}}'],
  [/^(company|organization|org)(_?name)?$/, '{{faker.company.name}}'],
  [/^(title|headline|subject)$/, '{{faker.book.title}}'],
  [/^(description|bio|summary|body|content|text|message|comment)$/, '{{faker.lorem.sentence}}'],
  [/colou?r/, '{{faker.color.human}}'],
  [/currency/, '{{faker.finance.currencyCode}}'],
  [/^(slug)$/, '{{faker.lorem.slug}}'],
  [/^(tag|category|department)$/, '{{faker.commerce.department}}'],
  [/^(product|product_?name)$/, '{{faker.commerce.productName}}'],
  [/(token|secret|api_?key)$/, '{{faker.string.alphanumeric(32)}}'],
  [
    /(created|updated|deleted|published|modified)(_?at|_?on|_?date)?$|_at$|date$|time$/,
    '{{faker.date.recent}}',
  ],
  [/(^|_)id$|uuid|guid/, '{{uuid}}'],
]

const NUMBER_HINTS: [RegExp, string][] = [
  [/price|amount|total|cost|balance|subtotal/, '{{faker.commerce.price}}'],
  [/(^|_)(age)$/, '{{int 18 80}}'],
  [/(lat|latitude)$/, '{{faker.location.latitude}}'],
  [/(lng|lon|longitude)$/, '{{faker.location.longitude}}'],
  [/(rating|score|stars)$/, '{{int 1 5}}'],
  [/(count|quantity|qty|stock)$/, '{{int 0 500}}'],
  [/(^|_)id$/, '{{int 1 1000}}'],
]

interface GenContext {
  root: OpenApiDocument
  stack: string[]
  depth: number
  /** Top-level property name → template, e.g. `id` → `{{params.id}}`. */
  paramBindings: Record<string, string>
}

function quote(template: string) {
  return `"${template}"`
}

function typeOf(schema: Schema): string | undefined {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== 'null')
  if (schema.type) return schema.type
  if (schema.properties) return 'object'
  if (schema.items) return 'array'
  return undefined
}

function mergeAllOf(schemas: Schema[], ctx: GenContext): Schema {
  const merged: Schema = { type: 'object', properties: {} }
  for (const part of schemas) {
    const resolved = deref(part, ctx)
    if (resolved.allOf)
      Object.assign(merged.properties!, mergeAllOf(resolved.allOf, ctx).properties)
    Object.assign(merged.properties!, resolved.properties ?? {})
    if (resolved.example !== undefined && Object.keys(merged.properties!).length === 0)
      merged.example = resolved.example
  }
  return merged
}

function deref(schema: Schema, ctx: GenContext): Schema {
  let current = schema
  let guard = 0
  while (current.$ref && guard++ < 20) {
    const target = resolvePointer(ctx.root, current.$ref) as Schema | undefined
    if (!target) return {}
    current = target
  }
  return current
}

function scalarTemplate(schema: Schema, type: string | undefined, name: string): string {
  const key = name.toLowerCase()
  if (schema.enum?.length) {
    const options = schema.enum.filter((v) => v !== null)
    if (options.every((v) => typeof v === 'string')) {
      return quote(`{{pick ${options.map((v) => JSON.stringify(v)).join(' ')}}}`)
    }
    return JSON.stringify(options[0] ?? null)
  }
  switch (type) {
    case 'integer': {
      if (schema.minimum !== undefined || schema.maximum !== undefined) {
        return `{{int ${schema.minimum ?? 0} ${schema.maximum ?? (schema.minimum ?? 0) + 1000}}}`
      }
      return NUMBER_HINTS.find(([re]) => re.test(key))?.[1] ?? '{{int 1 100}}'
    }
    case 'number': {
      if (schema.minimum !== undefined || schema.maximum !== undefined) {
        return `{{float ${schema.minimum ?? 0} ${schema.maximum ?? (schema.minimum ?? 0) + 1000} 2}}`
      }
      return NUMBER_HINTS.find(([re]) => re.test(key))?.[1] ?? '{{float 0 1000 2}}'
    }
    case 'boolean':
      return '{{bool}}'
    case 'string':
    default: {
      const byFormat = schema.format ? STRING_FORMATS[schema.format] : undefined
      const template =
        byFormat ?? NAME_HINTS.find(([re]) => re.test(key))?.[1] ?? '{{faker.word.words(2)}}'
      return quote(template)
    }
  }
}

function pad(level: number) {
  return '  '.repeat(level)
}

/** Converts a JSON schema into a MockForge template producing realistic data. */
export function schemaToTemplate(schema: Schema, ctx: GenContext, name = '', level = 0): string {
  if (ctx.depth > 8) return 'null'
  const ref = schema.$ref
  if (ref) {
    if (ctx.stack.includes(ref)) return 'null' // recursive schema
    const resolved = deref(schema, ctx)
    return schemaToTemplate(resolved, { ...ctx, stack: [...ctx.stack, ref] }, name, level)
  }

  if (schema.example !== undefined) return JSON.stringify(schema.example)
  if (schema.examples?.length) return JSON.stringify(schema.examples[0])

  if (schema.allOf?.length) return schemaToTemplate(mergeAllOf(schema.allOf, ctx), ctx, name, level)
  const alternative = schema.oneOf?.[0] ?? schema.anyOf?.[0]
  if (alternative) return schemaToTemplate(alternative, ctx, name, level)

  const type = typeOf(schema)
  const inner: GenContext = { ...ctx, depth: ctx.depth + 1 }

  if (type === 'object') {
    const entries = Object.entries(schema.properties ?? {})
    if (!entries.length) return '{}'
    const lines = entries.map(([prop, propSchema]) => {
      const param = level === 0 ? ctx.paramBindings[prop] : undefined
      const propType = typeOf(deref(propSchema ?? {}, ctx))
      const numeric = propType === 'integer' || propType === 'number'
      const value = param
        ? numeric
          ? `{{params.${param}}}`
          : quote(`{{params.${param}}}`)
        : schemaToTemplate(propSchema ?? {}, { ...inner, paramBindings: {} }, prop, level + 1)
      return `${pad(level + 1)}${JSON.stringify(prop)}: ${value}`
    })
    return `{\n${lines.join(',\n')}\n${pad(level)}}`
  }

  if (type === 'array') {
    const items = schema.items ?? {}
    const min = schema.minItems ?? (level === 0 ? 5 : 2)
    const max = Math.max(min, Math.min(schema.maxItems ?? min, min + 3))
    const count = min === max ? `${min}` : `${min} ${max}`
    const item = schemaToTemplate(items, inner, singularize(name), level + 1)
    if (!item.includes('\n')) return `[{{#repeat ${count}}}${item}{{/repeat}}]`
    return `[\n${pad(level + 1)}{{#repeat ${count}}}\n${pad(level + 1)}${item}\n${pad(level + 1)}{{/repeat}}\n${pad(level)}]`
  }

  if (!type && !schema.enum) return schema.nullable ? 'null' : '{}'
  return scalarTemplate(schema, type, name)
}

function singularize(name: string) {
  return name.endsWith('s') ? name.slice(0, -1) : name
}

/* ------------------------------------------------------------------ */
/* Document → collection                                               */
/* ------------------------------------------------------------------ */

function pickMedia(
  content: Record<string, MediaType> | undefined,
): [string, MediaType] | undefined {
  if (!content) return undefined
  const entries = Object.entries(content)
  return entries.find(([type]) => type.includes('json')) ?? entries[0]
}

function exampleOf(media: MediaType, root: OpenApiDocument): Json | undefined {
  if (media.example !== undefined) return media.example
  const first = media.examples ? Object.values(media.examples)[0] : undefined
  if (first) {
    const resolved = first.$ref
      ? (resolvePointer(root, first.$ref) as { value?: Json } | undefined)
      : first
    if (resolved?.value !== undefined) return resolved.value
  }
  return undefined
}

function statusOf(code: string): number {
  if (code === 'default') return 500
  const wildcard = /^([1-5])XX$/i.exec(code)
  if (wildcard) return Number(wildcard[1]) * 100
  const n = Number(code)
  return Number.isInteger(n) && n >= 100 && n <= 599 ? n : 200
}

function variantName(status: number, response: ResponseObject): string {
  const description = response.description?.split('\n')[0]?.trim()
  if (description && description.length <= 40) return description
  if (status >= 200 && status < 300) return 'Success'
  if (status >= 400 && status < 500) return 'Client error'
  return 'Server error'
}

/** Maps response property names to path params, e.g. `/pets/{petId}` binds `id` and `petId`. */
function paramBindingsFor(path: string): Record<string, string> {
  const names = extractParamNames(path)
  const bindings: Record<string, string> = {}
  for (const name of names) bindings[name] = name
  const last = names[names.length - 1]
  if (last && /id$/i.test(last) && !bindings.id) bindings.id = last
  return bindings
}

function buildVariants(
  operation: Operation,
  path: string,
  root: OpenApiDocument,
  warnings: string[],
  label: string,
): ResponseVariant[] {
  const responses = Object.entries(operation.responses ?? {})
  if (!responses.length) {
    warnings.push(`${label}: no responses defined, created a default 200`)
    return [createVariant()]
  }
  const ordered = responses
    .map(([code, raw]) => {
      const response = (raw?.$ref ? resolvePointer(root, raw.$ref) : raw) as
        ResponseObject | undefined
      return { status: statusOf(code), response: response ?? {} }
    })
    .sort((a, b) => {
      const rank = (s: number) => (s >= 200 && s < 300 ? 0 : 1)
      return rank(a.status) - rank(b.status) || a.status - b.status
    })

  return ordered.map(({ status, response }) => {
    const media = pickMedia(response.content)
    const headers = media ? [createKeyValue('Content-Type', media[0])] : []
    let body = ''
    if (media) {
      const example = exampleOf(media[1], root)
      if (example !== undefined) {
        body =
          typeof example === 'string' && !media[0].includes('json')
            ? example
            : JSON.stringify(example, null, 2)
      } else if (media[1].schema) {
        body = schemaToTemplate(media[1].schema, {
          root,
          stack: [],
          depth: 0,
          paramBindings: paramBindingsFor(path),
        })
      }
    }
    return createVariant({ name: variantName(status, response), status, headers, body })
  })
}

export function importOpenApi(text: string): OpenApiImportResult {
  const doc = parseSpecText(text)
  if (doc.swagger) {
    throw new OpenApiImportError(
      'Swagger 2.0 is not supported. Convert it to OpenAPI 3 (e.g. with swagger2openapi) and try again.',
    )
  }
  if (!doc.openapi || !String(doc.openapi).startsWith('3')) {
    throw new OpenApiImportError('Missing "openapi: 3.x" field — is this an OpenAPI 3 document?')
  }
  if (!doc.paths || typeof doc.paths !== 'object' || !Object.keys(doc.paths).length) {
    throw new OpenApiImportError('The spec has no paths to import')
  }

  const warnings: string[] = []
  const endpoints: Endpoint[] = []
  const lowerMethods = HTTP_METHODS.map((m) => m.toLowerCase())

  for (const [rawPath, item] of Object.entries(doc.paths)) {
    if (!item || typeof item !== 'object') continue
    const path = fromOpenApiPath(rawPath)
    for (const [method, value] of Object.entries(item)) {
      if (!lowerMethods.includes(method)) continue
      const operation = (value ?? {}) as Operation
      const upper = method.toUpperCase() as HttpMethod
      const label = `${upper} ${rawPath}`
      try {
        endpoints.push(
          createEndpoint({
            method: upper,
            path,
            name: operation.summary ?? operation.operationId ?? '',
            description: operation.description ?? '',
            variants: buildVariants(operation, path, doc, warnings, label),
          }),
        )
      } catch (error) {
        warnings.push(`${label}: skipped (${(error as Error).message})`)
      }
    }
  }

  if (!endpoints.length) throw new OpenApiImportError('No operations found under "paths"')

  const title = doc.info?.title?.trim() || 'Imported API'
  const server = doc.servers?.[0]?.url
  if (server && /^https?:\/\//.test(server)) {
    warnings.push(
      `Original server ${server} was mapped to /api/${slugify(title)} so mocks work on any host`,
    )
  }

  return {
    collection: createCollection({
      name: title,
      description: doc.info?.description?.split('\n')[0] ?? `Imported from OpenAPI ${doc.openapi}`,
      baseUrl: `/api/${slugify(title)}`,
      endpoints,
    }),
    warnings,
  }
}
