import { create } from 'zustand'
import { createResource, generateCrudEndpoints } from '@/lib/crud'
import { db } from '@/lib/db'
import { cloneWithNewIds, createCollection, createEndpoint, createVariant } from '@/lib/factory'
import { createId } from '@/lib/id'
import { resourceKey } from '@/lib/resource-store'
import type { Collection, CrudResource, Endpoint, ResponseVariant } from '@/lib/types'
import { faker, resourceEvents, resourceStore } from '@/mocks/runtime'

const ACTIVE_KEY = 'mockforge:active-collection'

type Updater<T> = Partial<T> | ((current: T) => T)

function apply<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? updater(current) : { ...current, ...updater }
}

export interface WorkspaceState {
  ready: boolean
  collections: Collection[]
  activeCollectionId: string | null

  hydrate: () => Promise<void>
  setActiveCollection: (id: string | null) => void

  addCollection: (collection: Collection) => Collection
  createCollection: (partial?: Partial<Collection>) => Collection
  updateCollection: (id: string, updater: Updater<Collection>) => void
  deleteCollection: (id: string) => void
  duplicateCollection: (id: string) => Collection | null

  addEndpoint: (collectionId: string, partial?: Partial<Endpoint>) => Endpoint
  updateEndpoint: (collectionId: string, endpointId: string, updater: Updater<Endpoint>) => void
  updateVariant: (
    collectionId: string,
    endpointId: string,
    variantId: string,
    updater: Updater<ResponseVariant>,
  ) => void
  deleteEndpoint: (collectionId: string, endpointId: string) => void
  duplicateEndpoint: (collectionId: string, endpointId: string) => Endpoint | null

  addResource: (
    collectionId: string,
    name: string,
    partial?: Partial<CrudResource>,
  ) => { resource: CrudResource; endpoints: Endpoint[] }
  updateResource: (collectionId: string, resourceId: string, updater: Updater<CrudResource>) => void
  deleteResource: (collectionId: string, resourceId: string) => void
}

export const useWorkspace = create<WorkspaceState>()((set, get) => {
  const mutateCollection = (id: string, updater: (c: Collection) => Collection) =>
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...updater(c), updatedAt: Date.now() } : c,
      ),
    }))

  const mutateEndpoint = (
    collectionId: string,
    endpointId: string,
    updater: (e: Endpoint) => Endpoint,
  ) =>
    mutateCollection(collectionId, (c) => ({
      ...c,
      endpoints: c.endpoints.map((e) => (e.id === endpointId ? updater(e) : e)),
    }))

  return {
    ready: false,
    collections: [],
    activeCollectionId: null,

    async hydrate() {
      const collections = await db.collections.orderBy('updatedAt').reverse().toArray()
      const stored = localStorage.getItem(ACTIVE_KEY)
      const active = collections.find((c) => c.id === stored)?.id ?? collections[0]?.id ?? null
      set({ collections, activeCollectionId: active, ready: true })
    },

    setActiveCollection(id) {
      if (id) localStorage.setItem(ACTIVE_KEY, id)
      set({ activeCollectionId: id })
    },

    addCollection(input) {
      // Two collections on the same base URL would shadow each other, so suffix duplicates.
      const taken = new Set(get().collections.map((c) => c.baseUrl.replace(/\/+$/, '')))
      const base = input.baseUrl.replace(/\/+$/, '')
      let baseUrl = base
      for (let n = 2; taken.has(baseUrl); n++) baseUrl = `${base}-${n}`
      const collection = baseUrl === input.baseUrl ? input : { ...input, baseUrl }
      set((state) => ({ collections: [collection, ...state.collections] }))
      // Seed stateful resources right away so the Resources view has data to show.
      for (const resource of collection.resources) {
        const key = resourceKey(collection.id, resource.id)
        if (resourceStore.has(key)) continue
        try {
          resourceStore.seed(key, resource, faker)
        } catch {
          // An invalid record template seeds lazily (and reports the error) on first request.
        }
      }
      resourceEvents.emit()
      get().setActiveCollection(collection.id)
      return collection
    },

    createCollection(partial) {
      return get().addCollection(createCollection(partial))
    },

    updateCollection(id, updater) {
      mutateCollection(id, (c) => apply(c, updater))
    },

    deleteCollection(id) {
      const collection = get().collections.find((c) => c.id === id)
      collection?.resources.forEach((r) => resourceStore.drop(resourceKey(id, r.id)))
      set((state) => {
        const collections = state.collections.filter((c) => c.id !== id)
        const activeCollectionId =
          state.activeCollectionId === id ? (collections[0]?.id ?? null) : state.activeCollectionId
        if (activeCollectionId) localStorage.setItem(ACTIVE_KEY, activeCollectionId)
        return { collections, activeCollectionId }
      })
      resourceEvents.emit()
    },

    duplicateCollection(id) {
      const source = get().collections.find((c) => c.id === id)
      if (!source) return null
      const copy = cloneWithNewIds(source)
      copy.name = `${source.name} (copy)`
      copy.baseUrl = `${source.baseUrl.replace(/\/+$/, '')}-copy`
      return get().addCollection(copy)
    },

    addEndpoint(collectionId, partial) {
      const endpoint = createEndpoint({ path: '/new-endpoint', ...partial })
      mutateCollection(collectionId, (c) => ({ ...c, endpoints: [...c.endpoints, endpoint] }))
      return endpoint
    },

    updateEndpoint(collectionId, endpointId, updater) {
      mutateEndpoint(collectionId, endpointId, (e) => apply(e, updater))
    },

    updateVariant(collectionId, endpointId, variantId, updater) {
      mutateEndpoint(collectionId, endpointId, (e) => ({
        ...e,
        variants: e.variants.map((v) => (v.id === variantId ? apply(v, updater) : v)),
      }))
    },

    deleteEndpoint(collectionId, endpointId) {
      mutateCollection(collectionId, (c) => ({
        ...c,
        endpoints: c.endpoints.filter((e) => e.id !== endpointId),
      }))
    },

    duplicateEndpoint(collectionId, endpointId) {
      const collection = get().collections.find((c) => c.id === collectionId)
      const source = collection?.endpoints.find((e) => e.id === endpointId)
      if (!source) return null
      const variants = source.variants.map((v) =>
        createVariant({
          ...structuredClone(v),
          id: createId(),
          headers: v.headers.map((h) => ({ ...h, id: createId() })),
        }),
      )
      const activeIndex = source.variants.findIndex((v) => v.id === source.activeVariantId)
      const copy: Endpoint = {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} (copy)` : '',
        variants,
        activeVariantId: variants[Math.max(0, activeIndex)]!.id,
        enabled: false,
      }
      mutateCollection(collectionId, (c) => {
        const index = c.endpoints.findIndex((e) => e.id === endpointId)
        const endpoints = [...c.endpoints]
        endpoints.splice(index + 1, 0, copy)
        return { ...c, endpoints }
      })
      return copy
    },

    addResource(collectionId, name, partial) {
      const resource = createResource(name, partial)
      const endpoints = generateCrudEndpoints(resource)
      mutateCollection(collectionId, (c) => ({
        ...c,
        resources: [...c.resources, resource],
        endpoints: [...c.endpoints, ...endpoints],
      }))
      return { resource, endpoints }
    },

    updateResource(collectionId, resourceId, updater) {
      mutateCollection(collectionId, (c) => ({
        ...c,
        resources: c.resources.map((r) => (r.id === resourceId ? apply(r, updater) : r)),
      }))
    },

    deleteResource(collectionId, resourceId) {
      resourceStore.drop(resourceKey(collectionId, resourceId))
      mutateCollection(collectionId, (c) => ({
        ...c,
        resources: c.resources.filter((r) => r.id !== resourceId),
        endpoints: c.endpoints.filter((e) => e.crud?.resourceId !== resourceId),
      }))
      resourceEvents.emit()
    },
  }
})

/* ------------------------------------------------------------------ */
/* Write-behind persistence: diff collections by reference             */
/* ------------------------------------------------------------------ */

let persistTimer: ReturnType<typeof setTimeout> | undefined
let lastPersisted = new Map<string, Collection>()

export function startWorkspacePersistence() {
  lastPersisted = new Map(useWorkspace.getState().collections.map((c) => [c.id, c]))
  // Best-effort flush of the debounced save when the tab is hidden or closed.
  const flushNow = () => {
    clearTimeout(persistTimer)
    void flush()
  }
  window.addEventListener('pagehide', flushNow)
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'hidden' && flushNow(),
  )
  return useWorkspace.subscribe((state, prev) => {
    if (state.collections === prev.collections) return
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => void flush(), 200)
  })
}

async function flush() {
  const current = new Map(useWorkspace.getState().collections.map((c) => [c.id, c]))
  const changed = [...current.values()].filter((c) => lastPersisted.get(c.id) !== c)
  const removed = [...lastPersisted.keys()].filter((id) => !current.has(id))
  lastPersisted = current
  try {
    await db.transaction('rw', db.collections, async () => {
      if (changed.length) await db.collections.bulkPut(changed)
      if (removed.length) await db.collections.bulkDelete(removed)
    })
  } catch (error) {
    console.error('[mockforge] failed to save collections', error)
  }
}

export const selectCollection = (id: string | undefined) => (state: WorkspaceState) =>
  state.collections.find((c) => c.id === id)
