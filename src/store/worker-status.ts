import { create } from 'zustand'

export type WorkerStatus = 'starting' | 'ready' | 'unsupported' | 'error'

interface WorkerState {
  status: WorkerStatus
  message: string
  /** False after a hard reload: the page is not controlled by the service worker. */
  controlled: boolean
  set: (state: Partial<Omit<WorkerState, 'set'>>) => void
}

export const useWorkerStatus = create<WorkerState>()((set) => ({
  status: 'starting',
  message: '',
  controlled: true,
  set: (state) => set(state),
}))
