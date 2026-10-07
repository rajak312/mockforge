import { describe, expect, it, vi } from 'vitest'
import { createResource, generateCrudEndpoints, handleCrudRequest } from './crud'
import { createFaker } from './faker'
import { generateRecords, ResourceStore } from './resource-store'

const KEY = 'c1:users'

function seededStore() {
  const persist = vi.fn()
  const store = new ResourceStore(persist)
  store.load(KEY, [
    { id: 1, name: 'Asha', role: 'admin', age: 31 },
    { id: 2, name: 'Bilal', role: 'viewer', age: 25 },
    { id: 3, name: 'Chen', role: 'viewer', age: 40 },
  ])
  return { store, persist }
}

describe('ResourceStore', () => {
  it('lists with pagination metadata', () => {
    const { store } = seededStore()
    const result = store.list(KEY, { page: 2, limit: 2 })
    expect(result.data.map((r) => r.id)).toEqual([3])
    expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, pages: 2 })
  })

  it('searches, filters and sorts', () => {
    const { store } = seededStore()
    expect(store.list(KEY, { q: 'bil' }).data.map((r) => r.name)).toEqual(['Bilal'])
    expect(store.list(KEY, { filters: { role: 'viewer' } }).meta.total).toBe(2)
    expect(store.list(KEY, { sort: 'age', order: 'desc' }).data.map((r) => r.age)).toEqual([
      40, 31, 25,
    ])
    expect(store.list(KEY, { sort: 'name' }).data.map((r) => r.name)).toEqual([
      'Asha',
      'Bilal',
      'Chen',
    ])
  })

  it('creates records with incrementing numeric ids and persists', () => {
    const { store, persist } = seededStore()
    const created = store.create(KEY, 'id', { name: 'Dana' })
    expect(created).toEqual({ id: 4, name: 'Dana' })
    expect(store.get(KEY, 'id', '4')).toEqual(created)
    expect(persist).toHaveBeenCalledWith(KEY, expect.arrayContaining([created]))
  })

  it('rejects duplicate ids', () => {
    const { store } = seededStore()
    expect(() => store.create(KEY, 'id', { id: 1, name: 'Dup' })).toThrow(/already exists/)
  })

  it('replaces (PUT) and merges (PATCH) while keeping the id', () => {
    const { store } = seededStore()
    expect(store.update(KEY, 'id', '1', { name: 'Asha K' }, false)).toEqual({
      id: 1,
      name: 'Asha K',
    })
    expect(store.update(KEY, 'id', '2', { role: 'editor', id: 99 }, true)).toEqual({
      id: 2,
      name: 'Bilal',
      role: 'editor',
      age: 25,
    })
    expect(store.update(KEY, 'id', '404', {}, true)).toBeNull()
  })

  it('removes records', () => {
    const { store } = seededStore()
    expect(store.remove(KEY, 'id', '1')).toBe(true)
    expect(store.remove(KEY, 'id', '1')).toBe(false)
    expect(store.count(KEY)).toBe(2)
  })

  it('returns copies so callers cannot mutate internal state', () => {
    const { store } = seededStore()
    const record = store.get(KEY, 'id', '1')!
    record.name = 'Mutated'
    expect(store.get(KEY, 'id', '1')!.name).toBe('Asha')
  })
})

describe('generateRecords', () => {
  it('renders seedCount records with sequential ids', () => {
    const resource = createResource('users', { seedCount: 5 })
    const records = generateRecords(resource, createFaker(7))
    expect(records).toHaveLength(5)
    expect(records.map((r) => r.id)).toEqual([1, 2, 3, 4, 5])
    expect(typeof records[0]!.email).toBe('string')
  })

  it('throws a helpful error when the template is not an object', () => {
    const resource = createResource('things', { recordTemplate: '[1, 2]' })
    expect(() => generateRecords(resource, createFaker(1))).toThrow(/JSON object/)
  })
})

describe('CRUD resources', () => {
  it('generates six REST endpoints bound to the resource', () => {
    const resource = createResource('users')
    const endpoints = generateCrudEndpoints(resource)
    expect(endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /users',
      'POST /users',
      'GET /users/:id',
      'PUT /users/:id',
      'PATCH /users/:id',
      'DELETE /users/:id',
    ])
    expect(endpoints.every((e) => e.crud?.resourceId === resource.id)).toBe(true)
    expect(endpoints[0]!.variants[0]!.fromStore).toBe(true)
  })

  it('reflects POST in subsequent GET requests (stateful)', () => {
    const resource = createResource('users', { seedCount: 3 })
    const store = new ResourceStore()
    const faker = createFaker(1)
    const req = (method: string, params = {}, body: unknown = null, query = {}) => ({
      method,
      params,
      query,
      body,
    })

    const listBefore = handleCrudRequest('list', resource, store, KEY, req('GET'), faker)
    expect((listBefore.body as { meta: { total: number } }).meta.total).toBe(3)

    const created = handleCrudRequest(
      'create',
      resource,
      store,
      KEY,
      req('POST', {}, { name: 'Lalit' }),
      faker,
    )
    expect(created).toEqual({ status: 201, body: { id: 4, name: 'Lalit' } })

    expect(handleCrudRequest('get', resource, store, KEY, req('GET', { id: '4' }), faker)).toEqual({
      status: 200,
      body: { id: 4, name: 'Lalit' },
    })

    const patched = handleCrudRequest(
      'update',
      resource,
      store,
      KEY,
      req('PATCH', { id: '4' }, { role: 'admin' }),
      faker,
    )
    expect(patched.body).toEqual({ id: 4, name: 'Lalit', role: 'admin' })

    expect(
      handleCrudRequest('delete', resource, store, KEY, req('DELETE', { id: '4' }), faker).status,
    ).toBe(204)
    expect(
      handleCrudRequest('get', resource, store, KEY, req('GET', { id: '4' }), faker).status,
    ).toBe(404)
  })

  it('validates bodies and filters lists by query', () => {
    const resource = createResource('users')
    const store = new ResourceStore()
    store.load(KEY, [
      { id: 1, role: 'admin' },
      { id: 2, role: 'viewer' },
    ])
    const faker = createFaker(1)
    expect(
      handleCrudRequest(
        'create',
        resource,
        store,
        KEY,
        { method: 'POST', params: {}, query: {}, body: 'x' },
        faker,
      ).status,
    ).toBe(400)
    const list = handleCrudRequest(
      'list',
      resource,
      store,
      KEY,
      { method: 'GET', params: {}, query: { role: 'admin' }, body: null },
      faker,
    )
    expect((list.body as { data: unknown[] }).data).toEqual([{ id: 1, role: 'admin' }])
  })
})
