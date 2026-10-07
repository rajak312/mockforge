import { describe, expect, it } from 'vitest'
import { createResource, generateCrudEndpoints } from './crud'
import { createCollection, createEndpoint, createVariant } from './factory'
import {
  buildShareUrl,
  CollectionFormatError,
  decodeShare,
  encodeShare,
  exportCollection,
  extractSharePayload,
  importCollectionJson,
  normalizeCollection,
} from './serialize'
import type { Collection } from './types'

function sample(): Collection {
  const resource = createResource('users', { seedCount: 4 })
  return createCollection({
    name: 'Blog API',
    description: 'Posts and authors',
    baseUrl: '/api/blog',
    resources: [resource],
    endpoints: [
      createEndpoint({
        method: 'GET',
        path: '/posts/:id',
        selection: 'rules',
        query: [{ id: 'q1', key: 'draft', value: '' }],
        variants: [
          createVariant({ name: 'OK', body: '{"id": "{{params.id}}"}', delay: 120 }),
          createVariant({
            name: 'Missing',
            status: 404,
            body: '{"error": "not found"}',
            rules: [{ id: 'r1', source: 'param', key: 'id', operator: 'equals', value: '0' }],
          }),
        ],
      }),
      ...generateCrudEndpoints(resource),
    ],
  })
}

/** Removes volatile fields so collections can be compared structurally. */
function shape(collection: Collection) {
  const resourceNames = new Map(collection.resources.map((r) => [r.id, r.name]))
  return {
    name: collection.name,
    description: collection.description,
    baseUrl: collection.baseUrl,
    resources: collection.resources.map(({ id: _id, ...rest }) => rest),
    endpoints: collection.endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      selection: e.selection,
      enabled: e.enabled,
      query: e.query.map(({ key, value }) => ({ key, value })),
      active: e.variants.findIndex((v) => v.id === e.activeVariantId),
      crud: e.crud
        ? { action: e.crud.action, resource: resourceNames.get(e.crud.resourceId) }
        : undefined,
      variants: e.variants.map(({ id: _id, headers, rules, ...v }) => ({
        ...v,
        headers: headers.map(({ key, value, enabled }) => ({ key, value, enabled })),
        rules: rules.map(({ id: _rid, ...r }) => r),
      })),
    })),
  }
}

describe('share URLs', () => {
  it('round-trips a collection through the compressed payload', () => {
    const original = sample()
    const decoded = decodeShare(encodeShare(original))
    expect(shape(decoded)).toEqual(shape(original))
    expect(decoded.id).not.toBe(original.id)
  })

  it('re-links CRUD endpoints to regenerated resource ids', () => {
    const decoded = decodeShare(encodeShare(sample()))
    const resourceId = decoded.resources[0]!.id
    expect(
      decoded.endpoints.filter((e) => e.crud).every((e) => e.crud!.resourceId === resourceId),
    ).toBe(true)
  })

  it('produces URL-safe payloads that are much smaller than raw JSON', () => {
    const original = sample()
    const encoded = encodeShare(original)
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$_]+$/)
    expect(encoded.length).toBeLessThan(JSON.stringify(original).length / 2)
  })

  it('builds and parses share URLs', () => {
    const url = buildShareUrl(sample(), 'https://mockforge.dev')
    expect(url.startsWith('https://mockforge.dev/share#')).toBe(true)
    expect(decodeShare(extractSharePayload(url)).name).toBe('Blog API')
    expect(extractSharePayload('  abc ')).toBe('abc')
  })

  it('rejects corrupted payloads', () => {
    expect(() => decodeShare('not-a-valid-payload')).toThrow(CollectionFormatError)
    expect(() => decodeShare('')).toThrow(CollectionFormatError)
  })
})

describe('collection JSON', () => {
  it('round-trips through export/import', () => {
    const original = sample()
    const imported = importCollectionJson(exportCollection(original))
    expect(shape(imported)).toEqual(shape(original))
  })

  it('accepts bare collection objects and normalises bad data', () => {
    const collection = normalizeCollection({
      name: '  ',
      endpoints: [
        { method: 'yeet', path: '', variants: [{ status: 9999, delay: -5, headers: 'nope' }] },
        { method: 'GET', variants: [] },
      ],
    })
    expect(collection.name).toBe('Imported API')
    expect(collection.endpoints).toHaveLength(1)
    const [endpoint] = collection.endpoints
    expect(endpoint!.method).toBe('GET')
    expect(endpoint!.path).toBe('/')
    expect(endpoint!.variants[0]).toMatchObject({ status: 200, delay: 0, headers: [] })
  })

  it('rejects invalid files', () => {
    expect(() => importCollectionJson('{')).toThrow(/not valid JSON/)
    expect(() => importCollectionJson('[]')).toThrow(/collection object/)
    expect(() =>
      importCollectionJson('{"format":"mockforge.collection","version":99,"collection":{}}'),
    ).toThrow(/newer version/)
  })
})
