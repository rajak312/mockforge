import type { HttpMethod } from './types'

export const STATUS_TEXT: Record<number, string> = {
  100: 'Continue',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export const COMMON_STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503]

export function statusText(status: number): string {
  return STATUS_TEXT[status] ?? ''
}

export function methodHasBody(method: HttpMethod | string): boolean {
  return !['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(method.toUpperCase())
}

/** Null-body statuses cannot carry a response body per the Fetch spec. */
export function isNullBodyStatus(status: number): boolean {
  return status === 101 || status === 204 || status === 205 || status === 304
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function tryFormatJson(text: string): { ok: true; value: string } | { ok: false } {
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(text), null, 2) }
  } catch {
    return { ok: false }
  }
}

/** Sent by the API client so log entries can be correlated with responses. */
export const REQUEST_ID_HEADER = 'x-mockforge-request-id'

export const HEADER_SUGGESTIONS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Cache-Control',
  'Set-Cookie',
  'Location',
  'Retry-After',
  'X-Request-Id',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'Access-Control-Allow-Origin',
]
