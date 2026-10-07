import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { cloneWithNewIds } from './factory'
import { createId } from './id'
import {
  HTTP_METHODS,
  type Collection,
  type CrudResource,
  type Endpoint,
  type HttpMethod,
  type KeyValue,
  type MatchRule,
  type ResponseVariant,
} from './types'

export const EXPORT_FORMAT = 'mockforge.collection'
export const EXPORT_VERSION = 1

export interface CollectionExport {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  collection: Collection
}

export class CollectionFormatError extends Error {
  override name = 'CollectionFormatError'
}

/* ------------------------------------------------------------------ */
/* Defensive normalisation of untrusted input                          */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function keyValue(v: unknown): KeyValue | null {
  if (!isObj(v)) return null
  return {
    id: str(v.id) || createId(),
    key: str(v.key),
    value: str(v.value),
    enabled: v.enabled !== false,
  }
}

const RULE_SOURCES = ['param', 'query', 'header', 'body'] as const
const RULE_OPERATORS = ['equals', 'notEquals', 'contains', 'exists', 'regex'] as const

function rule(v: unknown): MatchRule | null {
  if (!isObj(v)) return null
  const source = RULE_SOURCES.find((s) => s === v.source) ?? 'query'
  const operator = RULE_OPERATORS.find((o) => o === v.operator) ?? 'equals'
  return { id: str(v.id) || createId(), source, key: str(v.key), operator, value: str(v.value) }
}

function variant(v: unknown): ResponseVariant | null {
  if (!isObj(v)) return null
  const status = Math.round(num(v.status, 200))
  return {
    id: str(v.id) || createId(),
    name: str(v.name, 'Response') || 'Response',
    status: status >= 100 && status <= 599 ? status : 200,
    headers: arr(v.headers)
      .map(keyValue)
      .filter((x): x is KeyValue => x !== null),
    delay: Math.max(0, Math.min(60_000, Math.round(num(v.delay, 0)))),
    body: str(v.body),
    rules: arr(v.rules)
      .map(rule)
      .filter((x): x is MatchRule => x !== null),
    ...(v.fromStore === true ? { fromStore: true } : {}),
  }
}

function endpoint(v: unknown): Endpoint | null {
  if (!isObj(v)) return null
  const method = String(v.method ?? 'GET').toUpperCase() as HttpMethod
  const variants = arr(v.variants)
    .map(variant)
    .filter((x): x is ResponseVariant => x !== null)
  if (!variants.length) return null
  const activeVariantId = variants.some((x) => x.id === v.activeVariantId)
    ? str(v.activeVariantId)
    : variants[0]!.id
  const crud = isObj(v.crud) && typeof v.crud.resourceId === 'string' ? v.crud : undefined
  const actions = ['list', 'get', 'create', 'update', 'delete'] as const
  const action = actions.find((a) => a === crud?.action)
  return {
    id: str(v.id) || createId(),
    name: str(v.name),
    description: str(v.description),
    method: HTTP_METHODS.includes(method) ? method : 'GET',
    path: str(v.path, '/') || '/',
    enabled: v.enabled !== false,
    query: arr(v.query)
      .filter(isObj)
      .map((q) => ({ id: str(q.id) || createId(), key: str(q.key), value: str(q.value) })),
    variants,
    activeVariantId,
    selection: v.selection === 'rules' ? 'rules' : 'active',
    ...(crud && action ? { crud: { resourceId: str(crud.resourceId), action } } : {}),
  }
}

function resource(v: unknown): CrudResource | null {
  if (!isObj(v) || !str(v.name)) return null
  return {
    id: str(v.id) || createId(),
    name: str(v.name),
    path: str(v.path) || `/${str(v.name)}`,
    idField: str(v.idField) || 'id',
    seedCount: Math.max(0, Math.min(500, Math.round(num(v.seedCount, 10)))),
    recordTemplate: str(v.recordTemplate, '{}'),
  }
}

/** Validates and normalises an arbitrary value into a {@link Collection}. */
export function normalizeCollection(value: unknown): Collection {
  if (!isObj(value)) throw new CollectionFormatError('Expected a collection object')
  if (!Array.isArray(value.endpoints))
    throw new CollectionFormatError('Collection is missing "endpoints"')
  const now = Date.now()
  return {
    id: str(value.id) || createId(),
    name: str(value.name, 'Imported API').trim() || 'Imported API',
    description: str(value.description),
    baseUrl: str(value.baseUrl) || '/api',
    endpoints: value.endpoints.map(endpoint).filter((x): x is Endpoint => x !== null),
    resources: arr(value.resources)
      .map(resource)
      .filter((x): x is CrudResource => x !== null),
    createdAt: num(value.createdAt, now),
    updatedAt: num(value.updatedAt, now),
  }
}

/* ------------------------------------------------------------------ */
/* JSON export / import                                                */
/* ------------------------------------------------------------------ */

export function exportCollection(collection: Collection): string {
  const payload: CollectionExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    collection,
  }
  return JSON.stringify(payload, null, 2)
}

/** Accepts a MockForge export file or a bare collection object. Ids are regenerated. */
export function importCollectionJson(text: string): Collection {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new CollectionFormatError('File is not valid JSON')
  }
  if (isObj(data) && data.format === EXPORT_FORMAT) {
    if (num(data.version, 0) > EXPORT_VERSION) {
      throw new CollectionFormatError('This file was exported by a newer version of MockForge')
    }
    data = data.collection
  }
  return cloneWithNewIds(normalizeCollection(data))
}

/* ------------------------------------------------------------------ */
/* Share URLs                                                          */
/* ------------------------------------------------------------------ */

/**
 * Compact payload: random ids compress poorly, so they are dropped (or replaced by
 * short indexes) and regenerated on import.
 */
function toSharePayload(collection: Collection): unknown {
  const resourceRefs = new Map(collection.resources.map((r, i) => [r.id, `r${i}`]))
  return {
    v: EXPORT_VERSION,
    name: collection.name,
    description: collection.description,
    baseUrl: collection.baseUrl,
    resources: collection.resources.map(({ id, ...rest }) => ({
      ...rest,
      id: resourceRefs.get(id),
    })),
    endpoints: collection.endpoints.map(({ id: _id, activeVariantId, crud, ...e }) => ({
      ...e,
      active: Math.max(
        0,
        e.variants.findIndex((v) => v.id === activeVariantId),
      ),
      ...(crud
        ? { crud: { ...crud, resourceId: resourceRefs.get(crud.resourceId) ?? crud.resourceId } }
        : {}),
      query: e.query.map(({ key, value }) => ({ key, value })),
      variants: e.variants.map(({ id: _vid, headers, rules, ...v }) => ({
        ...v,
        headers: headers.map(({ key, value, enabled }) => ({ key, value, enabled })),
        rules: rules.map(({ source, key, operator, value }) => ({ source, key, operator, value })),
      })),
    })),
  }
}

/** Restores `activeVariantId` from the index stored in share payloads. */
function fromSharePayload(data: unknown): unknown {
  if (!isObj(data)) return data
  return {
    ...data,
    endpoints: arr(data.endpoints).map((raw) => {
      if (!isObj(raw)) return raw
      const variants = arr(raw.variants).map((v) => (isObj(v) ? { ...v, id: createId() } : v))
      const active = variants[num(raw.active, 0)]
      return { ...raw, variants, activeVariantId: isObj(active) ? active.id : undefined }
    }),
  }
}

export function encodeShare(collection: Collection): string {
  return compressToEncodedURIComponent(JSON.stringify(toSharePayload(collection)))
}

export function decodeShare(encoded: string): Collection {
  const json = decompressFromEncodedURIComponent(encoded.trim())
  if (!json) throw new CollectionFormatError('The share link is incomplete or corrupted')
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new CollectionFormatError('The share link is incomplete or corrupted')
  }
  if (isObj(data) && num(data.v, 1) > EXPORT_VERSION) {
    throw new CollectionFormatError('This link was created by a newer version of MockForge')
  }
  return cloneWithNewIds(normalizeCollection(fromSharePayload(data)))
}

/** Builds `https://host/share#<payload>`. The hash never reaches the server. */
export function buildShareUrl(collection: Collection, origin: string): string {
  return `${origin}/share#${encodeShare(collection)}`
}

export function extractSharePayload(input: string): string {
  const trimmed = input.trim()
  const hashIndex = trimmed.indexOf('#')
  return hashIndex === -1 ? trimmed : trimmed.slice(hashIndex + 1)
}
