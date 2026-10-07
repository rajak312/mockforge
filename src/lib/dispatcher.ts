import type { Faker } from '@faker-js/faker'
import { handleCrudRequest } from './crud'
import { isNullBodyStatus } from './http'
import {
  matchPath,
  parseBaseUrl,
  pathSpecificity,
  stripBaseUrl,
  validateBaseUrl,
  type PathParams,
} from './path-match'
import { resourceKey, type ResourceStore } from './resource-store'
import { renderTemplate, type TemplateContext } from './template'
import type {
  Collection,
  Endpoint,
  MatchRule,
  MockRequest,
  MockResponse,
  ResponseVariant,
} from './types'

export interface DispatchContext {
  collections: Collection[]
  /** Origin that relative base URLs resolve against (usually `location.origin`). */
  appOrigin: string
  store: ResourceStore
  faker: Faker
  now?: () => Date
}

export type DispatchOutcome =
  'matched' | 'no-route' | 'method-not-allowed' | 'template-error' | 'resource-missing'

export interface DispatchResult {
  outcome: DispatchOutcome
  collectionId: string
  endpointId?: string
  variantId?: string
  params: PathParams
  response: MockResponse
}

export interface ParsedRequest {
  url: URL
  query: Record<string, string | string[]>
  headers: Record<string, string>
  body: unknown
}

export function parseRequest(request: MockRequest, appOrigin: string): ParsedRequest {
  const url = new URL(request.url, appOrigin)
  const query: Record<string, string | string[]> = {}
  for (const [key, value] of url.searchParams) {
    const existing = query[key]
    if (existing === undefined) query[key] = value
    else query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
  }
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(request.headers)) headers[key.toLowerCase()] = value
  return { url, query, headers, body: parseBody(request.body, headers['content-type'] ?? '') }
}

function parseBody(raw: string, contentType: string): unknown {
  if (!raw) return undefined
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw))
  }
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function bodyPath(body: unknown, path: string): unknown {
  if (!path) return body
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object') return (value as Record<string, unknown>)[key]
    return undefined
  }, body)
}

function ruleValue(rule: MatchRule, params: PathParams, req: ParsedRequest): string | undefined {
  switch (rule.source) {
    case 'param':
      return params[rule.key]
    case 'query':
      return firstValue(req.query[rule.key])
    case 'header':
      return req.headers[rule.key.toLowerCase()]
    case 'body': {
      const value = bodyPath(req.body, rule.key)
      if (value === undefined) return undefined
      return typeof value === 'string' ? value : JSON.stringify(value)
    }
  }
}

export function ruleMatches(rule: MatchRule, params: PathParams, req: ParsedRequest): boolean {
  const actual = ruleValue(rule, params, req)
  switch (rule.operator) {
    case 'exists':
      return actual !== undefined
    case 'equals':
      return actual === rule.value
    case 'notEquals':
      return actual !== rule.value
    case 'contains':
      return actual !== undefined && actual.includes(rule.value)
    case 'regex':
      try {
        return actual !== undefined && new RegExp(rule.value).test(actual)
      } catch {
        return false
      }
  }
}

export function selectVariant(
  endpoint: Endpoint,
  params: PathParams,
  req: ParsedRequest,
): ResponseVariant | undefined {
  const active =
    endpoint.variants.find((v) => v.id === endpoint.activeVariantId) ?? endpoint.variants[0]
  if (endpoint.selection !== 'rules') return active
  return (
    endpoint.variants.find(
      (variant) =>
        variant.rules.length > 0 && variant.rules.every((rule) => ruleMatches(rule, params, req)),
    ) ?? active
  )
}

function queryMatches(endpoint: Endpoint, req: ParsedRequest): boolean {
  return endpoint.query.every((matcher) => {
    if (!matcher.key) return true
    const actual = req.query[matcher.key]
    if (actual === undefined) return false
    if (!matcher.value) return true
    return Array.isArray(actual) ? actual.includes(matcher.value) : actual === matcher.value
  })
}

/** Cheap check used by the MSW handler to let unrelated requests pass through. */
export function matchCollection(url: URL, collections: Collection[], appOrigin: string): boolean {
  return collections.some(
    (collection) =>
      !validateBaseUrl(collection.baseUrl) &&
      stripBaseUrl(url, collection.baseUrl, appOrigin) !== null,
  )
}

/** Picks the collection with the longest matching base URL. */
function findCollection(url: URL, collections: Collection[], appOrigin: string) {
  let best: { collection: Collection; path: string; weight: number } | null = null
  for (const collection of collections) {
    if (validateBaseUrl(collection.baseUrl)) continue
    const path = stripBaseUrl(url, collection.baseUrl, appOrigin)
    if (path === null) continue
    const { origin, prefix } = parseBaseUrl(collection.baseUrl)
    const weight = prefix.length + (origin ? 1 : 0)
    if (!best || weight > best.weight) best = { collection, path, weight }
  }
  return best
}

function headersOf(variant: ResponseVariant): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const header of variant.headers) {
    if (header.enabled && header.key.trim()) headers[header.key.trim()] = header.value
  }
  return headers
}

function contentTypeOf(headers: Record<string, string>): string {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
  return key ? headers[key]!.toLowerCase() : ''
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): MockResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body, null, 2),
    delay: 0,
  }
}

/** Finds the endpoints matching the request path + method + query (most specific first). */
export function findEndpoint(
  collection: Collection,
  method: string,
  path: string,
  req: ParsedRequest,
) {
  const candidates = collection.endpoints
    .filter((endpoint) => endpoint.enabled)
    .map((endpoint) => ({ endpoint, params: matchPath(endpoint.path, path) }))
    .filter((c): c is { endpoint: Endpoint; params: PathParams } => c.params !== null)

  const byMethod = candidates
    .filter(
      ({ endpoint }) =>
        endpoint.method === method || (method === 'HEAD' && endpoint.method === 'GET'),
    )
    .filter(({ endpoint }) => queryMatches(endpoint, req))
    .sort(
      (a, b) =>
        pathSpecificity(b.endpoint.path) - pathSpecificity(a.endpoint.path) ||
        b.endpoint.query.length - a.endpoint.query.length,
    )

  return { match: byMethod[0], allowed: [...new Set(candidates.map((c) => c.endpoint.method))] }
}

/**
 * Resolves a request against the user's collections. Returns `null` when the URL
 * is outside every collection base URL, meaning the request should pass through.
 */
export function dispatch(request: MockRequest, ctx: DispatchContext): DispatchResult | null {
  const req = parseRequest(request, ctx.appOrigin)
  const found = findCollection(req.url, ctx.collections, ctx.appOrigin)
  if (!found) return null
  const { collection, path } = found
  const method = request.method.toUpperCase()
  const { match, allowed } = findEndpoint(collection, method, path, req)

  if (!match) {
    if (allowed.length) {
      return {
        outcome: 'method-not-allowed',
        collectionId: collection.id,
        params: {},
        response: json(
          405,
          { error: 'Method Not Allowed', message: `${method} is not mocked for ${path}`, allowed },
          { Allow: allowed.join(', ') },
        ),
      }
    }
    return {
      outcome: 'no-route',
      collectionId: collection.id,
      params: {},
      response: json(404, {
        error: 'No mock matches this request',
        message: `${method} ${path} is not defined in "${collection.name}"`,
      }),
    }
  }

  const { endpoint, params } = match
  const variant = selectVariant(endpoint, params, req)
  const base = { collectionId: collection.id, endpointId: endpoint.id, params }
  if (!variant) {
    return {
      ...base,
      outcome: 'template-error',
      response: json(500, { error: 'Endpoint has no responses' }),
    }
  }

  const headers = headersOf(variant)
  const withVariant = { ...base, variantId: variant.id }

  if (variant.fromStore && endpoint.crud) {
    const resource = collection.resources.find((r) => r.id === endpoint.crud!.resourceId)
    if (!resource) {
      return {
        ...withVariant,
        outcome: 'resource-missing',
        response: json(500, {
          error: 'Resource was deleted',
          message: 'Regenerate the CRUD resource',
        }),
      }
    }
    try {
      const result = handleCrudRequest(
        endpoint.crud.action,
        resource,
        ctx.store,
        resourceKey(collection.id, resource.id),
        { method, params, query: req.query, body: req.body },
        ctx.faker,
      )
      return {
        ...withVariant,
        outcome: 'matched',
        response: {
          status: result.status,
          headers: { 'Content-Type': 'application/json', ...headers },
          body:
            result.body === null || isNullBodyStatus(result.status)
              ? ''
              : JSON.stringify(result.body, null, 2),
          delay: variant.delay,
        },
      }
    } catch (error) {
      return {
        ...withVariant,
        outcome: 'template-error',
        response: json(500, { error: 'Resource store error', message: (error as Error).message }),
      }
    }
  }

  const contentType = contentTypeOf(headers)
  const isJson = contentType.includes('json')
  const templateContext: TemplateContext = {
    params,
    query: req.query,
    body: req.body,
    headers: req.headers,
  }
  const rendered = renderTemplate(variant.body, templateContext, {
    faker: ctx.faker,
    escape: isJson ? 'json' : 'none',
    ...(ctx.now ? { now: ctx.now } : {}),
  })

  if (!rendered.ok) {
    return {
      ...withVariant,
      outcome: 'template-error',
      response: json(500, {
        error: 'Template error',
        message: rendered.error,
        endpoint: `${endpoint.method} ${endpoint.path}`,
      }),
    }
  }

  let body = rendered.output
  if (isJson && body.trim()) {
    try {
      body = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      // Serve as-is: the editor already warns about invalid JSON.
    }
  }

  return {
    ...withVariant,
    outcome: 'matched',
    response: {
      status: variant.status,
      headers,
      body: isNullBodyStatus(variant.status) ? '' : body,
      delay: variant.delay,
    },
  }
}
