import { create } from 'zustand'
import { DEMO_TEMPLATE } from '@/lib/starters'

interface DemoState {
  template: string
  setTemplate: (template: string) => void
  reset: () => void
}

/** Template served at /api/demo/users/:id for the landing page live demo (not persisted). */
export const useDemo = create<DemoState>()((set) => ({
  template: DEMO_TEMPLATE,
  setTemplate: (template) => set({ template }),
  reset: () => set({ template: DEMO_TEMPLATE }),
}))
