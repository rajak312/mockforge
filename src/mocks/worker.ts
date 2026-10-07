import { delay, http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { dispatch, matchCollection } from '@/lib/dispatcher'
import { REQUEST_ID_HEADER } from '@/lib/http'
import { createId } from '@/lib/id'
import { buildDemoCollection } from '@/lib/starters'
import type { Collection } from '@/lib/types'
import { useDemo } from '@/store/demo'
import { useLogs } from '@/store/logs'
import { useWorkerStatus } from '@/store/worker-status'
import { useWorkspace } from '@/store/workspace'
import { faker, resourceEvents, resourceStore } from './runtime'

function activeCollections(): Collection[] {
  return [...useWorkspace.getState().collections, buildDemoCollection(useDemo.getState().template)]
}

const handler = http.all('*', async ({ request }) => {
  const started = performance.now()
  const collections = activeCollections()
  const appOrigin = location.origin
  const url = new URL(request.url)

  // Fast path: requests outside every collection base URL (assets, HMR, CDNs) pass through.
  if (!matchCollection(url, collections, appOrigin)) return undefined

  const requestHeaders = Object.fromEntries(request.headers.entries())
  const requestBody = ['GET', 'HEAD'].includes(request.method) ? '' : await request.clone().text()

  const result = dispatch(
    { method: request.method, url: request.url, headers: requestHeaders, body: requestBody },
    {
      collections,
      appOrigin,
      store: resourceStore,
      faker,
    },
  )
  if (!result) return undefined

  const { response } = result
  if (response.delay > 0) await delay(Math.min(response.delay, 60_000))

  const collection = collections.find((c) => c.id === result.collectionId)
  const endpoint = collection?.endpoints.find((e) => e.id === result.endpointId)
  const variant = endpoint?.variants.find((v) => v.id === result.variantId)
  const endpointLabel = endpoint ? `${endpoint.method} ${endpoint.path}` : undefined

  const headers = new Headers(response.headers)
  if (endpointLabel) headers.set('X-MockForge-Endpoint', endpointLabel)
  if (variant) headers.set('X-MockForge-Variant', encodeURIComponent(variant.name))

  if (endpoint?.crud && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
    resourceEvents.emit()

  const durationMs = Math.round(performance.now() - started)
  useLogs.getState().add({
    id: createId(),
    requestId: request.headers.get(REQUEST_ID_HEADER),
    timestamp: Date.now(),
    method: request.method,
    url: request.url,
    path: url.pathname + url.search,
    status: response.status,
    durationMs,
    outcome: result.outcome,
    collectionId: result.collectionId,
    collectionName: collection?.name ?? '',
    endpointId: result.endpointId,
    endpointLabel,
    variantId: result.variantId,
    variantName: variant?.name,
    params: result.params,
    requestHeaders,
    requestBody,
    responseHeaders: Object.fromEntries(headers.entries()),
    responseBody: response.body,
  })

  const status = response.status >= 200 && response.status <= 599 ? response.status : 500
  return new HttpResponse(response.body === '' ? null : response.body, { status, headers })
})

let starting: Promise<void> | null = null

export function startMockWorker(): Promise<void> {
  if (starting) return starting
  const status = useWorkerStatus.getState()
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.set({
      status: 'unsupported',
      message:
        'Service workers need a secure context (https or localhost) and a supporting browser.',
    })
    return Promise.resolve()
  }
  const worker = setupWorker(handler)
  starting = worker
    .start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
    .then(() => {
      status.set({
        status: 'ready',
        message: '',
        controlled: navigator.serviceWorker.controller !== null,
      })
      navigator.serviceWorker.addEventListener('controllerchange', () =>
        useWorkerStatus.getState().set({ controlled: navigator.serviceWorker.controller !== null }),
      )
    })
    .catch((error: unknown) => {
      status.set({ status: 'error', message: (error as Error).message })
    })
  return starting
}
