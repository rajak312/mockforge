import { create } from 'zustand'

export type ImportTab = 'openapi' | 'json' | 'link'

interface UiState {
  paletteOpen: boolean
  shortcutsOpen: boolean
  importTab: ImportTab | null
  resourceDialogOpen: boolean
  collectionDialog: { mode: 'create' } | { mode: 'edit'; id: string } | null
  sidebarOpen: boolean
  set: (state: Partial<Omit<UiState, 'set'>>) => void
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  importTab: null,
  resourceDialogOpen: false,
  collectionDialog: null,
  sidebarOpen: false,
  set: (state) => set(state),
}))
