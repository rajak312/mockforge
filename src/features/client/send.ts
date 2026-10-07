import { db, HISTORY_LIMIT, type HistoryEntry } from '@/lib/db'
import { methodHasBody, REQUEST_ID_HEADER } from '@/lib/http'
import { createId } from '@/lib/id'
import type { ClientResponse, RequestDraft } from '@/store/client'

export class RequestError extends Error {
  override name = 'RequestError'
}

export async function sendRequest(draft: RequestDraft): Promise<ClientResponse> {
  let url: URL
  try {
    url = new URL(draft.url.trim(), location.origin)
  } catch {
    throw new RequestError(
      'Enter a valid URL, e.g. /api/shop/products or https://api.example.com/users',
    )
  }
  const headers = new Headers()
  for (const h of draft.headers) {
    if (!h.enabled || !h.key.trim()) continue
    try {
      headers.set(h.key.trim(), h.value)
    } catch {
      throw new RequestError(`Invalid header name "${h.key}"`)
    }
  }
  headers.set(REQUEST_ID_HEADER, createId())

  const started = performance.now()
  let response: Response
  try {
    response = await fetch(url, {
      method: draft.method,
      headers,
      body: methodHasBody(draft.method) && draft.body ? draft.body : undefined,
      signal: AbortSignal.timeout(65_000),
      cache: 'no-store',
    })
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'timed out after 65s'
        : (error as Error).message
    throw new RequestError(
      `Request failed (${reason}). URLs outside your collections' base URLs go to the real network — check the URL or CORS.`,
    )
  }
  const body = await response.text()
  const durationMs = Math.round(performance.now() - started)
  const variant = response.headers.get('x-mockforge-variant')
  return {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers.entries()],
    body,
    durationMs,
    size: new TextEncoder().encode(body).length,
    endpoint: response.headers.get('x-mockforge-endpoint'),
    variant: variant ? decodeURIComponent(variant) : null,
    receivedAt: Date.now(),
  }
}

export async function saveHistory(entry: Omit<HistoryEntry, 'id'>) {
  await db.history.add(entry)
  const count = await db.history.count()
  if (count > HISTORY_LIMIT) {
    const stale = await db.history
      .orderBy('timestamp')
      .limit(count - HISTORY_LIMIT)
      .primaryKeys()
    await db.history.bulkDelete(stale)
  }
}
