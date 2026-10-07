import { describe, expect, it } from 'vitest'
import { createResource, generateCrudEndpoints } from '../crud'
import { createCollection, createEndpoint, createKeyValue, createVariant } from '../factory'
import { compileTemplate, emptyUses } from './js'
import { generateHandler, generateHandlersFile } from './msw'
import { shellQuote, toCurl } from './curl'

function compile(source: string) {
  const uses = emptyUses()
  return { result: compileTemplate(source, uses), uses }
}

describe('compileTemplate', () => {
  it('turns JSON templates into object literals with real expressions', () => {
    const { result, uses } = compile(
      '{"id": "{{params.id}}", "name": "{{faker.person.fullName}}", "page": {{query.page ?? 1}}}',
    )
    expect(result).toEqual({
      kind: 'json',
      code: "{\n  id: params.id,\n  name: faker.person.fullName(),\n  page: Number((url.searchParams.get('page') ?? 1)),\n}",
    })
    expect(uses).toMatchObject({ params: true, faker: true, url: true, request: true })
  })

  it('compiles repeat blocks to Array.from with index', () => {
    const { result } = compile(
      '{"items": [{{#repeat 3}}{"n": {{@index}}, "id": "{{uuid}}"}{{/repeat}}]}',
    )
    expect(result.kind).toBe('json')
    expect((result as { code: string }).code).toContain(
      'items: Array.from({ length: 3 }, (_, index) => ({\n    n: index,\n    id: crypto.randomUUID(),\n  }))',
    )
  })

  it('uses random lengths for ranged repeats and spreads mixed arrays', () => {
    const { result } = compile('[1, {{#repeat 2 4}}"{{faker.word.noun}}"{{/repeat}}]')
    expect((result as { code: string }).code).toContain(
      '...Array.from({ length: faker.number.int({ min: 2, max: 4 }) }',
    )
  })

  it('builds template literals for mixed strings and passes faker args', () => {
    const { result } = compile(
      '{"greeting": "Hi {{body.user.name}}!", "n": {{faker.number.int({"max": 9})}}}',
    )
    const code = (result as { code: string }).code
    expect(code).toContain('greeting: `Hi ${body?.user?.name}!`')
    expect(code).toContain('n: faker.number.int({"max":9})')
  })

  it('falls back to a template literal when the template is not JSON', () => {
    const { result } = compile('Hello {{params.name}} `x`')
    expect(result).toEqual({ kind: 'text', code: '`Hello ${params.name} \\`x\\``' })
  })

  it('produces code that evaluates to the same structure', () => {
    const { result } = compile(
      '{"list": [{{#repeat 2}}{"i": {{@index}}, "label": "item-{{@index}}"}{{/repeat}}], "ok": true}',
    )
    const value = new Function(`return (${(result as { code: string }).code})`)() as unknown
    expect(value).toEqual({
      list: [
        { i: 0, label: 'item-0' },
        { i: 1, label: 'item-1' },
      ],
      ok: true,
    })
  })
})

describe('generateHandler', () => {
  const collection = createCollection({ name: 'Shop', baseUrl: '/api/shop' })

  it('generates a typed MSW handler with delay, status and headers', () => {
    const endpoint = createEndpoint({
      name: 'Get user',
      method: 'GET',
      path: '/users/:id',
      variants: [
        createVariant({
          status: 202,
          delay: 250,
          headers: [
            createKeyValue('Content-Type', 'application/json'),
            createKeyValue('X-Trace', 'abc'),
          ],
          body: '{"id": "{{params.id}}"}',
        }),
      ],
    })
    const { code } = generateHandler(collection, endpoint)
    expect(code).toBe(
      [
        '// Get user',
        "http.get('/api/shop/users/:id', async ({ params }) => {",
        '  await delay(250)',
        "  return HttpResponse.json({\n    id: params.id,\n  }, { status: 202, headers: { 'X-Trace': 'abc' } })",
        '})',
      ].join('\n'),
    )
  })

  it('emits rule branches, query guards and body parsing', () => {
    const ok = createVariant({ name: 'OK', body: '{"ok": true}' })
    const denied = createVariant({
      name: 'Denied',
      status: 403,
      body: '{"email": "{{body.email}}"}',
      rules: [{ id: 'r', source: 'body', key: 'email', operator: 'contains', value: '@blocked' }],
    })
    const endpoint = createEndpoint({
      method: 'POST',
      path: '/login',
      selection: 'rules',
      query: [{ id: 'q', key: 'v', value: '2' }],
      variants: [ok, denied],
    })
    const { code } = generateHandler(collection, endpoint)
    expect(code).toContain("http.post('/api/shop/login', async ({ request }) => {")
    expect(code).toContain('const url = new URL(request.url)')
    expect(code).toContain('const body = (await request.clone().json().catch(() => null))')
    expect(code).toContain("if (url.searchParams.get('v') !== '2') return")
    expect(code).toContain("if (String(body?.email ?? '').includes('@blocked')) {")
    expect(code).toContain(
      'return HttpResponse.json({\n      email: body?.email,\n    }, { status: 403 })',
    )
    expect(code).toContain('return HttpResponse.json({\n    ok: true,\n  })')
  })

  it('handles empty and text bodies', () => {
    const noContent = createEndpoint({
      method: 'DELETE',
      path: '/x',
      variants: [createVariant({ status: 204 })],
    })
    expect(generateHandler(collection, noContent).code).toContain(
      'return new HttpResponse(null, { status: 204 })',
    )
    const text = createEndpoint({
      path: '/health',
      variants: [
        createVariant({
          headers: [createKeyValue('Content-Type', 'text/plain')],
          body: 'OK {{now}}',
        }),
      ],
    })
    expect(generateHandler(collection, text).code).toContain(
      "return new HttpResponse(`OK ${new Date().toISOString()}`, { status: 200, headers: { 'Content-Type': 'text/plain' } })",
    )
  })
})

describe('generateHandlersFile', () => {
  it('produces a module with imports, a CRUD db and every enabled handler', () => {
    const resource = createResource('users', { seedCount: 3 })
    const collection = createCollection({
      name: 'Shop',
      baseUrl: '/api/shop',
      resources: [resource],
      endpoints: [
        ...generateCrudEndpoints(resource),
        createEndpoint({ path: '/off', enabled: false }),
      ],
    })
    const file = generateHandlersFile(collection)
    expect(file).toMatch(
      /^import \{ http, HttpResponse \} from 'msw'\nimport \{ faker \} from '@faker-js\/faker'/,
    )
    expect(file).toContain(
      'const db = {\n  users: Array.from({ length: 3 }, (_, index) => ({\n    id: index + 1,',
    )
    expect(file).toContain("http.get('/api/shop/users', ({ request }) => {")
    expect(file).toContain("http.post('/api/shop/users', async ({ request }) => {")
    expect(file).toContain("http.patch('/api/shop/users/:id', async ({ request, params }) => {")
    expect(file).toContain('// (disabled) GET /off')
    expect(file).toContain('export const handlers = [')
  })
})

describe('toCurl', () => {
  it('quotes values safely for the shell', () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(
      toCurl({
        method: 'post',
        url: 'https://x.dev/api/users',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"O\'Neil"}',
      }),
    ).toBe(
      "curl \\\n  -X POST \\\n  'https://x.dev/api/users' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"name\":\"O'\\''Neil\"}'",
    )
    expect(toCurl({ method: 'GET', url: 'https://x.dev' })).toBe("curl \\\n  'https://x.dev'")
  })
})

describe('numeric faker strings', () => {
  it('coerces price-like faker values in raw JSON positions', () => {
    const uses = emptyUses()
    const result = compileTemplate(
      '{"price": {{faker.commerce.price}}, "label": "{{faker.commerce.price}}"}',
      uses,
    )
    expect((result as { code: string }).code).toBe(
      '{\n  price: Number(faker.commerce.price()),\n  label: faker.commerce.price(),\n}',
    )
  })
})
