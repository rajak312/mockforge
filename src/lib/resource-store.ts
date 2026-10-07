import type { Faker } from '@faker-js/faker'
import { renderTemplate } from './template'
import type { CrudResource } from './types'

export type ResourceRecord = Record<string, unknown>

export interface ListOptions {
  page?: number
  limit?: number
  /** Case-insensitive full-text search across string/number fields. */
  q?: string
  sort?: string
  order?: 'asc' | 'desc'
  /** Exact-match filters on top-level fields, e.g. `{ role: 'admin' }`. */
  filters?: Record<string, string>
}

export interface ListResult {
  data: ResourceRecord[]
  meta: { total: number; page: number; limit: number; pages: number }
}

export type PersistFn = (key: string, records: ResourceRecord[]) => void

export function resourceKey(collectionId: string, resourceId: string): string {
  return `${collectionId}:${resourceId}`
}

const clone = <T>(value: T): T => structuredClone(value)

/**
 * In-memory, synchronous record store with optional write-through persistence.
 * Synchronous reads keep MSW request handling fast and deterministic; the
 * persistence callback mirrors every mutation into IndexedDB.
 */
export class ResourceStore {
  private readonly tables = new Map<string, ResourceRecord[]>()

  constructor(private readonly persist?: PersistFn) {}

  has(key: string): boolean {
    return this.tables.has(key)
  }

  /** Hydrates a table without triggering persistence. */
  load(key: string, records: ResourceRecord[]): void {
    this.tables.set(key, clone(records))
  }

  all(key: string): ResourceRecord[] {
    return clone(this.tables.get(key) ?? [])
  }

  count(key: string): number {
    return this.tables.get(key)?.length ?? 0
  }

  replace(key: string, records: ResourceRecord[]): void {
    this.tables.set(key, clone(records))
    this.commit(key)
  }

  drop(key: string): void {
    this.tables.delete(key)
    this.persist?.(key, [])
  }

  /** Renders `resource.seedCount` records from the record template. */
  seed(key: string, resource: CrudResource, faker: Faker): ResourceRecord[] {
    const records = generateRecords(resource, faker)
    this.replace(key, records)
    return clone(records)
  }

  list(key: string, options: ListOptions = {}): ListResult {
    let rows = this.tables.get(key) ?? []

    const filters = Object.entries(options.filters ?? {})
    if (filters.length) {
      rows = rows.filter((row) => filters.every(([field, value]) => String(row[field]) === value))
    }

    const q = options.q?.trim().toLowerCase()
    if (q) {
      rows = rows.filter((row) =>
        Object.values(row).some(
          (value) =>
            (typeof value === 'string' || typeof value === 'number') &&
            String(value).toLowerCase().includes(q),
        ),
      )
    }

    if (options.sort) {
      const field = options.sort
      const direction = options.order === 'desc' ? -1 : 1
      rows = [...rows].sort((a, b) => {
        const x = a[field]
        const y = b[field]
        if (x === y) return 0
        if (x === undefined || x === null) return 1
        if (y === undefined || y === null) return -1
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * direction
        return String(x).localeCompare(String(y)) * direction
      })
    }

    const limit = clampInt(options.limit, 1, 100, 20)
    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const page = clampInt(options.page, 1, Number.MAX_SAFE_INTEGER, 1)
    const start = (page - 1) * limit
    return { data: clone(rows.slice(start, start + limit)), meta: { total, page, limit, pages } }
  }

  get(key: string, idField: string, id: string): ResourceRecord | null {
    const row = this.find(key, idField, id)
    return row ? clone(row) : null
  }

  create(key: string, idField: string, input: ResourceRecord): ResourceRecord {
    const rows = this.tables.get(key) ?? []
    const record: ResourceRecord = { ...clone(input) }
    const provided = record[idField]
    if (provided === undefined || provided === null || provided === '') {
      record[idField] = nextId(rows, idField)
    } else if (rows.some((row) => String(row[idField]) === String(provided))) {
      throw new ConflictError(`A record with ${idField} "${String(provided)}" already exists`)
    }
    this.tables.set(key, [...rows, record])
    this.commit(key)
    return clone(record)
  }

  /** `merge` = PATCH semantics, otherwise PUT (replace, keeping the id). */
  update(
    key: string,
    idField: string,
    id: string,
    input: ResourceRecord,
    merge: boolean,
  ): ResourceRecord | null {
    const rows = this.tables.get(key) ?? []
    const index = rows.findIndex((row) => String(row[idField]) === id)
    if (index === -1) return null
    const existing = rows[index]!
    const next: ResourceRecord = merge ? { ...existing, ...clone(input) } : { ...clone(input) }
    next[idField] = existing[idField]
    const copy = [...rows]
    copy[index] = next
    this.tables.set(key, copy)
    this.commit(key)
    return clone(next)
  }

  remove(key: string, idField: string, id: string): boolean {
    const rows = this.tables.get(key) ?? []
    const next = rows.filter((row) => String(row[idField]) !== id)
    if (next.length === rows.length) return false
    this.tables.set(key, next)
    this.commit(key)
    return true
  }

  private find(key: string, idField: string, id: string): ResourceRecord | undefined {
    return this.tables.get(key)?.find((row) => String(row[idField]) === id)
  }

  private commit(key: string) {
    this.persist?.(key, this.tables.get(key) ?? [])
  }
}

export class ConflictError extends Error {
  override name = 'ConflictError'
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Numeric ids continue from the max; otherwise a UUID is generated. */
function nextId(rows: ResourceRecord[], idField: string): number | string {
  if (rows.length === 0 || rows.every((row) => typeof row[idField] === 'number')) {
    return rows.reduce((max, row) => Math.max(max, Number(row[idField]) || 0), 0) + 1
  }
  return globalThis.crypto.randomUUID()
}

export function generateRecords(resource: CrudResource, faker: Faker): ResourceRecord[] {
  const records: ResourceRecord[] = []
  for (let i = 0; i < resource.seedCount; i++) {
    const rendered = renderTemplate(resource.recordTemplate, {}, { faker })
    if (!rendered.ok) throw new Error(`Record template error: ${rendered.error}`)
    let record: unknown
    try {
      record = JSON.parse(rendered.output)
    } catch {
      throw new Error('Record template must render a JSON object')
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Record template must render a JSON object')
    }
    records.push({ [resource.idField]: i + 1, ...(record as ResourceRecord) })
  }
  return records
}
