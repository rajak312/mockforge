import { describe, expect, it } from 'vitest'
import { createResource, generateCrudEndpoints } from './crud'
import { dispatch, type DispatchContext } from './dispatcher'
import { createCollection, createEndpoint, createVariant } from './factory'
import { createFaker } from './faker'
import { ResourceStore } from './resource-store'
import type { Collection, MockRequest } from './types'

const APP = 'https://mockforge.test'

function ctx(collections: Collection[]): DispatchContext {
  return { collections, appOrigin: APP, store: new ResourceStore(), faker: createFaker(1) }
}

const req = (
  method: string,
  url: string,
  body = '',
  headers: Record<string, string> = {},
): MockRequest => ({
  method,
  url,
  body,
  headers: body ? { 'content-type': 'application/json', ...headers } : headers,
})

function shop() {
  return createCollection({
    name: 'Shop',
    baseUrl: '/api/shop',
    endpoints: [
      createEndpoint({
        method: 'GET',
        path: '/users/:id',
        variants: [createVariant({ body: '{"id": "{{params.id}}", "page": {{query.page ?? 1}}}' })],
      }),
      createEndpoint({
        method: 'GET',
        path: '/users/me',
        variants: [createVariant({ body: '{"me": true}' })],
      }),
      createEndpoint({
        method: 'GET',
        path: '/search',
        query: [{ id: 'q', key: 'type', value: 'admin' }],
        variants: [createVariant({ body: '{"admins": true}' })],
      }),
      createEndpoint({
        method: 'GET',
        path: '/search',
        variants: [createVariant({ body: '{"all": true}' })],
      }),
      createEndpoint({ method: 'GET', path: '/off', enabled: false }),
    ],
  })
}

describe('dispatch', () => {
  it('passes through requests outside every collection', () => {
    expect(dispatch(req('GET', `${APP}/assets/app.js`), ctx([shop()]))).toBeNull()
    expect(dispatch(req('GET', 'https://cdn.example.com/x'), ctx([shop()]))).toBeNull()
  })

  it('renders templates with params and query', () => {
    const result = dispatch(req('GET', `${APP}/api/shop/users/42?page=3`), ctx([shop()]))!
    expect(result.outcome).toBe('matched')
    expect(JSON.parse(result.response.body)).toEqual({ id: '42', page: 3 })
    expect(result.params).toEqual({ id: '42' })
  })

  it('prefers static paths over params', () => {
    const result = dispatch(req('GET', `${APP}/api/shop/users/me`), ctx([shop()]))!
    expect(JSON.parse(result.response.body)).toEqual({ me: true })
  })

  it('honours query matchers and falls back to less specific endpoints', () => {
    expect(
      JSON.parse(
        dispatch(req('GET', `${APP}/api/shop/search?type=admin`), ctx([shop()]))!.response.body,
      ),
    ).toEqual({ admins: true })
    expect(
      JSON.parse(
        dispatch(req('GET', `${APP}/api/shop/search?type=user`), ctx([shop()]))!.response.body,
      ),
    ).toEqual({ all: true })
  })

  it('returns 404 for unknown and disabled routes, 405 for wrong methods', () => {
    expect(dispatch(req('GET', `${APP}/api/shop/nope`), ctx([shop()]))!.response.status).toBe(404)
    expect(dispatch(req('GET', `${APP}/api/shop/off`), ctx([shop()]))!.outcome).toBe('no-route')
    const notAllowed = dispatch(req('DELETE', `${APP}/api/shop/users/1`), ctx([shop()]))!
    expect(notAllowed.response.status).toBe(405)
    expect(notAllowed.response.headers.Allow).toBe('GET')
  })

  it('selects variants by rules, falling back to the active variant', () => {
    const ok = createVariant({ name: 'OK', body: '{"ok": true}' })
    const banned = createVariant({
      name: 'Banned',
      status: 403,
      body: '{"error": "banned"}',
      rules: [{ id: 'r', source: 'param', key: 'id', operator: 'equals', value: '13' }],
    })
    const premium = createVariant({
      name: 'Premium',
      body: '{"plan": "{{body.plan}}"}',
      rules: [
        { id: 'a', source: 'header', key: 'X-Plan', operator: 'exists', value: '' },
        { id: 'b', source: 'body', key: 'plan', operator: 'regex', value: '^pro' },
      ],
    })
    const collection = createCollection({
      baseUrl: 'https://api.example.com/v1',
      endpoints: [
        createEndpoint({
          method: 'POST',
          path: '/accounts/:id',
          selection: 'rules',
          variants: [ok, banned, premium],
        }),
      ],
    })
    const c = ctx([collection])
    const url = 'https://api.example.com/v1/accounts'
    expect(dispatch(req('POST', `${url}/13`, '{}'), c)!.response.status).toBe(403)
    expect(
      JSON.parse(
        dispatch(req('POST', `${url}/1`, '{"plan":"pro-yearly"}', { 'X-Plan': '1' }), c)!.response
          .body,
      ),
    ).toEqual({ plan: 'pro-yearly' })
    expect(
      JSON.parse(
        dispatch(req('POST', `${url}/1`, '{"plan":"free"}', { 'X-Plan': '1' }), c)!.response.body,
      ),
    ).toEqual({ ok: true })
  })

  it('returns a 500 with the message on template errors', () => {
    const collection = createCollection({
      baseUrl: '/api',
      endpoints: [
        createEndpoint({ path: '/broken', variants: [createVariant({ body: '{{#repeat 2}}' })] }),
      ],
    })
    const result = dispatch(req('GET', `${APP}/api/broken`), ctx([collection]))!
    expect(result.outcome).toBe('template-error')
    expect(result.response.status).toBe(500)
    expect(JSON.parse(result.response.body).message).toMatch(/Unclosed/)
  })

  it('does not JSON-escape plain text responses and strips bodies for 204', () => {
    const collection = createCollection({
      baseUrl: '/api',
      endpoints: [
        createEndpoint({
          path: '/text',
          variants: [
            createVariant({
              headers: [{ id: 'h', key: 'Content-Type', value: 'text/plain', enabled: true }],
              body: 'Hi "{{query.n}}"',
            }),
          ],
        }),
        createEndpoint({
          method: 'DELETE',
          path: '/x',
          variants: [createVariant({ status: 204, body: '{"ignored": true}' })],
        }),
      ],
    })
    expect(dispatch(req('GET', `${APP}/api/text?n=A"B`), ctx([collection]))!.response.body).toBe(
      'Hi "A"B"',
    )
    expect(dispatch(req('DELETE', `${APP}/api/x`), ctx([collection]))!.response.body).toBe('')
  })

  it('routes to the collection with the longest base URL', () => {
    const a = createCollection({
      baseUrl: '/api',
      endpoints: [createEndpoint({ path: '/v2/ping', variants: [createVariant({ body: '"a"' })] })],
    })
    const b = createCollection({
      baseUrl: '/api/v2',
      endpoints: [createEndpoint({ path: '/ping', variants: [createVariant({ body: '"b"' })] })],
    })
    expect(dispatch(req('GET', `${APP}/api/v2/ping`), ctx([a, b]))!.collectionId).toBe(b.id)
  })

  it('serves stateful CRUD endpoints from the store', () => {
    const resource = createResource('users', { seedCount: 2 })
    const collection = createCollection({
      baseUrl: '/api',
      resources: [resource],
      endpoints: generateCrudEndpoints(resource),
    })
    const c = ctx([collection])
    const created = dispatch(req('POST', `${APP}/api/users`, '{"name":"Lalit"}'), c)!
    expect(created.response.status).toBe(201)
    expect(JSON.parse(created.response.body)).toEqual({ id: 3, name: 'Lalit' })
    const fetched = dispatch(req('GET', `${APP}/api/users/3`), c)!
    expect(JSON.parse(fetched.response.body).name).toBe('Lalit')
    const list = JSON.parse(dispatch(req('GET', `${APP}/api/users`), c)!.response.body)
    expect(list.meta.total).toBe(3)
    expect(dispatch(req('DELETE', `${APP}/api/users/3`), c)!.response.status).toBe(204)
  })
})
