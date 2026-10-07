/**
 * Express-style path matching used by the mock dispatcher.
 *
 * Supported syntax:
 *   /users/:id        named parameter
 *   /users/:id?       optional trailing parameter
 *   /files/*          wildcard (captured as `params['*']`)
 */

type Segment =
  | { kind: 'static'; value: string }
  | { kind: 'param'; name: string; optional: boolean }
  | { kind: 'wildcard' }

export type PathParams = Record<string, string>

const compiled = new Map<string, Segment[]>()

export function normalizePath(path: string): string {
  let p = path.trim()
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/{2,}/g, '/')
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

function splitSegments(path: string): string[] {
  const p = normalizePath(path)
  return p === '/' ? [] : p.slice(1).split('/')
}

function compile(pattern: string): Segment[] {
  const cached = compiled.get(pattern)
  if (cached) return cached
  const segments: Segment[] = splitSegments(pattern).map((raw) => {
    if (raw === '*') return { kind: 'wildcard' }
    if (raw.startsWith(':') && raw.length > 1) {
      const optional = raw.endsWith('?')
      return { kind: 'param', name: raw.slice(1, optional ? -1 : undefined), optional }
    }
    return { kind: 'static', value: raw }
  })
  compiled.set(pattern, segments)
  return segments
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Returns extracted params when `pathname` matches `pattern`, otherwise `null`. */
export function matchPath(pattern: string, pathname: string): PathParams | null {
  const segments = compile(pattern)
  const parts = splitSegments(pathname)
  const params: PathParams = {}

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const part = parts[i]

    if (segment.kind === 'wildcard') {
      params['*'] = parts.slice(i).map(safeDecode).join('/')
      return params
    }
    if (part === undefined) {
      if (segment.kind === 'param' && segment.optional && i === segments.length - 1) return params
      return null
    }
    if (segment.kind === 'static') {
      if (segment.value !== part) return null
    } else {
      params[segment.name] = safeDecode(part)
    }
  }

  return parts.length === segments.length ? params : null
}

/**
 * Higher score = more specific. Static segments beat params which beat wildcards,
 * so `/users/me` wins over `/users/:id` regardless of definition order.
 */
export function pathSpecificity(pattern: string): number {
  return compile(pattern).reduce((score, segment, index) => {
    const weight = segment.kind === 'static' ? 3 : segment.kind === 'param' ? 2 : 1
    return score + weight * Math.pow(10, 6 - Math.min(index, 6))
  }, 0)
}

export function extractParamNames(pattern: string): string[] {
  return compile(pattern).flatMap((s) => (s.kind === 'param' ? [s.name] : []))
}

/** `/users/{userId}` → `/users/:userId` */
export function fromOpenApiPath(path: string): string {
  return normalizePath(path.replace(/\{([^}/]+)\}/g, (_, name: string) => `:${name}`))
}

/** `/users/:userId` → `/users/{userId}` */
export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)\??/g, (_, name: string) => `{${name}}`)
}

export interface ParsedBase {
  /** Absolute origin, or `null` when the base is relative to the app origin. */
  origin: string | null
  prefix: string
}

export function parseBaseUrl(baseUrl: string): ParsedBase {
  const trimmed = baseUrl.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const prefix = normalizePath(url.pathname)
      return { origin: url.origin, prefix: prefix === '/' ? '' : prefix }
    } catch {
      return { origin: null, prefix: '' }
    }
  }
  const prefix = normalizePath(trimmed || '/')
  return { origin: null, prefix: prefix === '/' ? '' : prefix }
}

/**
 * When `url` lives under `baseUrl`, returns the remaining path (always starting with `/`).
 * Relative bases are resolved against `appOrigin`.
 */
export function stripBaseUrl(url: URL, baseUrl: string, appOrigin: string): string | null {
  const { origin, prefix } = parseBaseUrl(baseUrl)
  if (url.origin !== (origin ?? appOrigin)) return null
  const pathname = normalizePath(url.pathname)
  if (!prefix) return pathname
  if (pathname === prefix) return '/'
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return null
}

/** Joins a base URL and an endpoint path without duplicate slashes. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const rest = normalizePath(path)
  return rest === '/' ? base || '/' : `${base}${rest}`
}

/** Fills `:params` in a pattern, leaving unknown ones intact (useful for samples). */
export function fillPath(pattern: string, values: PathParams): string {
  return pattern
    .replace(/:([A-Za-z0-9_]+)\??/g, (match, name: string) =>
      values[name] !== undefined ? encodeURIComponent(values[name]) : match,
    )
    .replace(/\*$/, values['*'] ?? '')
}

const RESERVED_PREFIXES = [
  '/app',
  '/share',
  '/assets',
  '/src',
  '/node_modules',
  '/@',
  '/mockServiceWorker.js',
]

/**
 * Returns a human readable problem with a base URL, or `null` when it is usable.
 * Relative bases must not shadow the app's own routes or assets.
 */
export function validateBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim()
  if (!trimmed) return 'Base URL is required'
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      new URL(trimmed)
      return null
    } catch {
      return 'Not a valid absolute URL'
    }
  }
  if (!trimmed.startsWith('/'))
    return 'Start with "/" (e.g. /api/shop) or use an absolute https:// URL'
  if (/[?#\s]/.test(trimmed)) return 'Base URL cannot contain spaces, "?" or "#"'
  const { prefix } = parseBaseUrl(trimmed)
  if (!prefix) return 'A relative base URL needs a prefix such as /api'
  const hit = RESERVED_PREFIXES.find((reserved) =>
    reserved === '/@'
      ? prefix.startsWith('/@')
      : prefix === reserved || prefix.startsWith(`${reserved}/`),
  )
  if (hit) return `"${prefix}" is reserved by the app. Try /api${prefix}`
  return null
}
