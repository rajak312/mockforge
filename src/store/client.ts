import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createKeyValue, JSON_HEADER } from '@/lib/factory'
import type { HttpMethod, KeyValue } from '@/lib/types'

export interface RequestDraft {
  method: HttpMethod
  url: string
  headers: KeyValue[]
  body: string
}

export interface ClientResponse {
  status: number
  statusText: string
  headers: [string, string][]
  body: string
  durationMs: number
  size: number
  /** Endpoint/variant reported by the mock worker. */
  endpoint: string | null
  variant: string | null
  receivedAt: number
}

export const emptyDraft = (url = ''): RequestDraft => ({
  method: 'GET',
  url,
  headers: [{ ...JSON_HEADER(), enabled: false }, createKeyValue()],
  body: '',
})

interface ClientState {
  /** Drafts are kept per collection so switching collections doesn't lose work. */
  drafts: Record<string, RequestDraft>
  response: ClientResponse | null
  error: string | null
  loading: boolean
  setDraft: (collectionId: string, draft: Partial<RequestDraft>) => void
  replaceDraft: (collectionId: string, draft: RequestDraft) => void
  set: (state: Partial<Pick<ClientState, 'response' | 'error' | 'loading'>>) => void
}

export const useClient = create<ClientState>()(
  persist(
    (set) => ({
      drafts: {},
      response: null,
      error: null,
      loading: false,
      setDraft: (collectionId, draft) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [collectionId]: { ...(state.drafts[collectionId] ?? emptyDraft()), ...draft },
          },
        })),
      replaceDraft: (collectionId, draft) =>
        set((state) => ({
          drafts: { ...state.drafts, [collectionId]: draft },
          response: null,
          error: null,
        })),
      set: (state) => set(state),
    }),
    { name: 'mockforge:client', partialize: (state) => ({ drafts: state.drafts }) },
  ),
)
