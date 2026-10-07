import { faker } from '@/lib/faker'
import { db } from '@/lib/db'
import { ResourceStore, type ResourceRecord } from '@/lib/resource-store'

const pending = new Map<string, ResourceRecord[]>()
let scheduled = false

/**
 * Write-through persistence: mutations in the same tick are coalesced into one
 * IndexedDB transaction, which starts immediately so a navigation right after a
 * POST cannot lose the write.
 */
function schedulePersist(key: string, records: ResourceRecord[]) {
  pending.set(key, records)
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    const batch = [...pending.entries()]
    pending.clear()
    void db
      .transaction('rw', db.records, async () => {
        for (const [k, rows] of batch) {
          if (rows.length === 0 && !resourceStore.has(k)) await db.records.delete(k)
          else await db.records.put({ key: k, records: rows })
        }
      })
      .catch((error: unknown) => console.error('[mockforge] failed to persist records', error))
  })
}

/** Singleton store shared by the MSW handler and the Resources UI. */
export const resourceStore = new ResourceStore(schedulePersist)

const listeners = new Set<() => void>()
let version = 0

/** Lets React views re-render when resource data changes. */
export const resourceEvents = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getVersion: () => version,
  emit() {
    version++
    listeners.forEach((l) => l())
  },
}

export async function hydrateResourceStore() {
  const tables = await db.records.toArray()
  for (const table of tables) resourceStore.load(table.key, table.records)
  resourceEvents.emit()
}

export { faker }
