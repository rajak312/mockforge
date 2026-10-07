import { createId, slugify } from './id'
import type { Collection, Endpoint, HttpMethod, KeyValue, ResponseVariant } from './types'

export const JSON_HEADER = (): KeyValue => ({
  id: createId(),
  key: 'Content-Type',
  value: 'application/json',
  enabled: true,
})

export function createKeyValue(key = '', value = ''): KeyValue {
  return { id: createId(), key, value, enabled: true }
}

export function createVariant(partial: Partial<ResponseVariant> = {}): ResponseVariant {
  return {
    id: createId(),
    name: 'Success',
    status: 200,
    headers: [JSON_HEADER()],
    delay: 0,
    body: '{\n  "ok": true\n}',
    rules: [],
    ...partial,
  }
}

export function createEndpoint(
  partial: Partial<Omit<Endpoint, 'variants' | 'activeVariantId'>> & {
    variants?: ResponseVariant[]
  } = {},
): Endpoint {
  const variants = partial.variants?.length ? partial.variants : [createVariant()]
  const method: HttpMethod = partial.method ?? 'GET'
  return {
    id: createId(),
    name: '',
    description: '',
    path: '/',
    enabled: true,
    query: [],
    selection: 'active',
    ...partial,
    method,
    variants,
    activeVariantId: variants[0]!.id,
  }
}

export function createCollection(partial: Partial<Collection> = {}): Collection {
  const now = Date.now()
  const name = partial.name ?? 'Untitled API'
  return {
    id: createId(),
    name,
    description: '',
    baseUrl: `/api/${slugify(name)}`,
    endpoints: [],
    resources: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

/** Deep-copies a collection giving every entity a fresh id (used for imports and duplicates). */
export function cloneWithNewIds(collection: Collection): Collection {
  const resourceIds = new Map<string, string>()
  const resources = collection.resources.map((resource) => {
    const id = createId()
    resourceIds.set(resource.id, id)
    return { ...resource, id }
  })
  const now = Date.now()
  return {
    ...structuredClone(collection),
    id: createId(),
    createdAt: now,
    updatedAt: now,
    resources,
    endpoints: collection.endpoints.map((endpoint) => {
      const variantIds = new Map<string, string>()
      const variants = endpoint.variants.map((variant) => {
        const id = createId()
        variantIds.set(variant.id, id)
        return {
          ...structuredClone(variant),
          id,
          headers: variant.headers.map((h) => ({ ...h, id: createId() })),
          rules: variant.rules.map((r) => ({ ...r, id: createId() })),
        }
      })
      return {
        ...structuredClone(endpoint),
        id: createId(),
        query: endpoint.query.map((q) => ({ ...q, id: createId() })),
        variants,
        activeVariantId: variantIds.get(endpoint.activeVariantId) ?? variants[0]?.id ?? '',
        ...(endpoint.crud
          ? {
              crud: {
                ...endpoint.crud,
                resourceId: resourceIds.get(endpoint.crud.resourceId) ?? endpoint.crud.resourceId,
              },
            }
          : {}),
      }
    }),
  }
}
