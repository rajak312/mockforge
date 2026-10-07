import { create } from 'zustand'
import type { DispatchOutcome } from '@/lib/dispatcher'

export interface LogEntry {
  id: string
  /** Correlates entries with API client requests (x-mockforge-request-id). */
  requestId: string | null
  timestamp: number
  method: string
  url: string
  path: string
  status: number
  durationMs: number
  outcome: DispatchOutcome
  collectionId: string
  collectionName: string
  endpointId?: string
  endpointLabel?: string
  variantId?: string
  variantName?: string
  params: Record<string, string>
  requestHeaders: Record<string, string>
  requestBody: string
  responseHeaders: Record<string, string>
  responseBody: string
}

const MAX_ENTRIES = 300

interface LogState {
  entries: LogEntry[]
  paused: boolean
  /** Entries received since the Logs view was last opened. */
  unseen: number
  add: (entry: LogEntry) => void
  clear: () => void
  setPaused: (paused: boolean) => void
  markSeen: () => void
}

export const useLogs = create<LogState>()((set) => ({
  entries: [],
  paused: false,
  unseen: 0,
  add: (entry) =>
    set((state) =>
      state.paused
        ? state
        : { entries: [entry, ...state.entries].slice(0, MAX_ENTRIES), unseen: state.unseen + 1 },
    ),
  clear: () => set({ entries: [], unseen: 0 }),
  setPaused: (paused) => set({ paused }),
  markSeen: () => set({ unseen: 0 }),
}))
