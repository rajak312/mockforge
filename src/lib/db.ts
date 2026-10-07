import Dexie, { type EntityTable } from 'dexie'
import type { ResourceRecord } from './resource-store'
import type { Collection } from './types'

export interface RecordTable {
  key: string
  records: ResourceRecord[]
}

export interface HistoryEntry {
  id?: number
  collectionId: string | null
  method: string
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  body: string
  status: number | null
  durationMs: number
  timestamp: number
}

/** IndexedDB schema. Collections are stored as whole documents (they are small). */
export class MockForgeDatabase extends Dexie {
  collections!: EntityTable<Collection, 'id'>
  records!: EntityTable<RecordTable, 'key'>
  history!: EntityTable<HistoryEntry, 'id'>

  constructor(name = 'mockforge') {
    super(name)
    this.version(1).stores({
      collections: 'id, updatedAt',
      records: 'key',
      history: '++id, timestamp, collectionId',
    })
  }
}

export const db = new MockForgeDatabase()

export const HISTORY_LIMIT = 100
