import type { Faker } from '@faker-js/faker'
import { extractParamNames, fillPath, joinUrl } from './path-match'
import { generateRecords } from './resource-store'
import type { Collection, Endpoint } from './types'

/** Plausible values for path params so "Try it" produces a matching URL. */
export function sampleParams(path: string): Record<string, string> {
  return Object.fromEntries(
    extractParamNames(path).map((name) => [
      name,
      /id$/i.test(name) ? '1' : name === '*' ? 'file.txt' : 'sample',
    ]),
  )
}

export function sampleUrl(collection: Collection, endpoint: Endpoint): string {
  const query = endpoint.query
    .filter((q) => q.key)
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value || 'true')}`)
    .join('&')
  const path = fillPath(endpoint.path, sampleParams(endpoint.path))
  return joinUrl(collection.baseUrl, path) + (query ? `?${query}` : '')
}

function sampleValue(key: string, faker: Faker): unknown {
  const k = key.toLowerCase()
  if (k.includes('email')) return faker.internet.email().toLowerCase()
  if (k.includes('password')) return 'correct-horse-battery'
  if (k.includes('name')) return faker.person.fullName()
  if (k.includes('price') || k.includes('amount')) return 49.99
  if (k.includes('quantity') || k.includes('count')) return 1
  return 'example'
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown) {
  let node = target
  path.slice(0, -1).forEach((key) => {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
    node = node[key] as Record<string, unknown>
  })
  node[path[path.length - 1]!] = value
}

/**
 * Builds a request body for "Try it": a seeded record for CRUD endpoints, otherwise
 * an object containing every `{{body.*}}` field referenced by the endpoint's responses.
 */
export function sampleRequestBody(
  collection: Collection,
  endpoint: Endpoint,
  faker: Faker,
): string {
  if (!['POST', 'PUT', 'PATCH'].includes(endpoint.method)) return ''
  const resource =
    endpoint.crud && collection.resources.find((r) => r.id === endpoint.crud!.resourceId)
  if (resource) {
    try {
      const [record] = generateRecords({ ...resource, seedCount: 1 }, faker)
      if (record) {
        delete record[resource.idField]
        return JSON.stringify(record, null, 2)
      }
    } catch {
      return '{}'
    }
  }
  const body: Record<string, unknown> = {}
  const paths = new Set<string>()
  for (const variant of endpoint.variants) {
    for (const match of variant.body.matchAll(/\{\{\s*body\.([\w.]+)/g)) paths.add(match[1]!)
    for (const rule of variant.rules) if (rule.source === 'body' && rule.key) paths.add(rule.key)
  }
  for (const path of paths)
    setPath(body, path.split('.'), sampleValue(path.split('.').pop()!, faker))
  return JSON.stringify(body, null, 2)
}
