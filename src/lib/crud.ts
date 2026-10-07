import type { Faker } from '@faker-js/faker'
import { createEndpoint, createVariant } from './factory'
import { createId } from './id'
import { normalizePath } from './path-match'
import { ConflictError, type ResourceRecord, type ResourceStore } from './resource-store'
import type { CrudAction, CrudResource, Endpoint, HttpMethod } from './types'

/** Field templates for common resource names; anything else gets a generic shape. */
const RECORD_PRESETS: Record<string, string> = {
  users: `{
  "name": "{{faker.person.fullName}}",
  "email": "{{faker.internet.email}}",
  "avatar": "{{faker.image.avatar}}",
  "role": "{{pick "admin" "editor" "viewer"}}",
  "createdAt": "{{faker.date.past}}"
}`,
  products: `{
  "name": "{{faker.commerce.productName}}",
  "price": {{faker.commerce.price}},
  "category": "{{faker.commerce.department}}",
  "inStock": {{bool}},
  "sku": "{{faker.string.alphanumeric({"length": 8, "casing": "upper"})}}"
}`,
  posts: `{
  "title": "{{faker.lorem.sentence}}",
  "body": "{{faker.lorem.paragraph}}",
  "author": "{{faker.person.fullName}}",
  "published": {{bool}},
  "publishedAt": "{{faker.date.recent}}"
}`,
  todos: `{
  "title": "{{faker.hacker.phrase}}",
  "completed": {{bool}},
  "dueDate": "{{faker.date.soon}}"
}`,
  orders: `{
  "customer": "{{faker.person.fullName}}",
  "total": {{faker.commerce.price({"min": 10, "max": 900})}},
  "status": "{{pick "pending" "paid" "shipped" "delivered"}}",
  "createdAt": "{{faker.date.recent}}"
}`,
  comments: `{
  "author": "{{faker.internet.username}}",
  "body": "{{faker.lorem.sentences(2)}}",
  "likes": {{int 0 250}},
  "createdAt": "{{faker.date.recent}}"
}`,
  companies: `{
  "name": "{{faker.company.name}}",
  "catchPhrase": "{{faker.company.catchPhrase}}",
  "city": "{{faker.location.city}}",
  "employees": {{int 5 5000}}
}`,
}

const GENERIC_PRESET = `{
  "name": "{{faker.word.words(2)}}",
  "description": "{{faker.lorem.sentence}}",
  "status": "{{pick "active" "archived"}}",
  "createdAt": "{{faker.date.past}}"
}`

export function defaultRecordTemplate(name: string): string {
  const key = name.toLowerCase().trim()
  return RECORD_PRESETS[key] ?? RECORD_PRESETS[`${key}s`] ?? GENERIC_PRESET
}

export const RESOURCE_PRESET_NAMES = Object.keys(RECORD_PRESETS)

export function createResource(name: string, partial: Partial<CrudResource> = {}): CrudResource {
  const clean =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'items'
  return {
    id: createId(),
    name: clean,
    path: normalizePath(`/${clean}`),
    idField: 'id',
    seedCount: 12,
    recordTemplate: defaultRecordTemplate(clean),
    ...partial,
  }
}

const ACTIONS: {
  action: CrudAction
  method: HttpMethod
  item: boolean
  status: number
  label: string
}[] = [
  { action: 'list', method: 'GET', item: false, status: 200, label: 'List' },
  { action: 'create', method: 'POST', item: false, status: 201, label: 'Create' },
  { action: 'get', method: 'GET', item: true, status: 200, label: 'Get' },
  { action: 'update', method: 'PUT', item: true, status: 200, label: 'Replace' },
  { action: 'update', method: 'PATCH', item: true, status: 200, label: 'Update' },
  { action: 'delete', method: 'DELETE', item: true, status: 204, label: 'Delete' },
]

function singular(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`
  if (name.endsWith('s')) return name.slice(0, -1)
  return name
}

/** Creates the six REST endpoints for a resource, all bound to the resource store. */
export function generateCrudEndpoints(resource: CrudResource): Endpoint[] {
  const one = singular(resource.name)
  return ACTIONS.map(({ action, method, item, status, label }) =>
    createEndpoint({
      name: `${label} ${item || action === 'create' ? one : resource.name}`,
      description: `Stateful: served from the "${resource.name}" resource store.`,
      method,
      path: item ? `${resource.path}/:${resource.idField}` : resource.path,
      crud: { resourceId: resource.id, action },
      variants: [
        createVariant({ name: 'From store', status, body: '', fromStore: true }),
        createVariant({
          name: 'Server error',
          status: 500,
          body: '{\n  "error": "Internal Server Error",\n  "requestId": "{{uuid}}"\n}',
        }),
      ],
    }),
  )
}

export interface CrudRequest {
  method: string
  params: Record<string, string>
  query: Record<string, string | string[]>
  body: unknown
}

export interface CrudResult {
  status: number
  body: unknown
}

const RESERVED_QUERY = new Set(['page', 'limit', 'q', 'sort', 'order'])

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isRecord(value: unknown): value is ResourceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Executes a CRUD action against the store, lazily seeding the table on first use. */
export function handleCrudRequest(
  action: CrudAction,
  resource: CrudResource,
  store: ResourceStore,
  key: string,
  request: CrudRequest,
  faker: Faker,
): CrudResult {
  if (!store.has(key)) store.seed(key, resource, faker)
  const id = request.params[resource.idField] ?? ''
  const notFound = (): CrudResult => ({
    status: 404,
    body: {
      error: 'Not Found',
      message: `No ${singular(resource.name)} with ${resource.idField} "${id}"`,
    },
  })

  switch (action) {
    case 'list': {
      const filters: Record<string, string> = {}
      for (const [field, value] of Object.entries(request.query)) {
        const v = first(value)
        if (!RESERVED_QUERY.has(field) && v !== undefined) filters[field] = v
      }
      const order = first(request.query.order)
      return {
        status: 200,
        body: store.list(key, {
          page: Number(first(request.query.page)) || undefined,
          limit: Number(first(request.query.limit)) || undefined,
          q: first(request.query.q),
          sort: first(request.query.sort),
          order: order === 'desc' ? 'desc' : 'asc',
          filters,
        }),
      }
    }
    case 'get': {
      const record = store.get(key, resource.idField, id)
      return record ? { status: 200, body: record } : notFound()
    }
    case 'create': {
      if (!isRecord(request.body)) {
        return {
          status: 400,
          body: { error: 'Bad Request', message: 'Request body must be a JSON object' },
        }
      }
      try {
        return { status: 201, body: store.create(key, resource.idField, request.body) }
      } catch (error) {
        if (error instanceof ConflictError)
          return { status: 409, body: { error: 'Conflict', message: error.message } }
        throw error
      }
    }
    case 'update': {
      if (!isRecord(request.body)) {
        return {
          status: 400,
          body: { error: 'Bad Request', message: 'Request body must be a JSON object' },
        }
      }
      const merge = request.method.toUpperCase() === 'PATCH'
      const record = store.update(key, resource.idField, id, request.body, merge)
      return record ? { status: 200, body: record } : notFound()
    }
    case 'delete':
      return store.remove(key, resource.idField, id) ? { status: 204, body: null } : notFound()
  }
}
