import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark' | 'system'
const KEY = 'mockforge:theme'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return media().matches ? 'dark' : 'light'
  return preference
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f7f8fb')
}

interface ThemeState {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (preference: ThemePreference) => void
  toggle: () => void
}

const initial = ((): ThemePreference => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
})()

export const useTheme = create<ThemeState>()((set, get) => ({
  preference: initial,
  resolved: typeof window !== 'undefined' ? resolve(initial) : 'dark',
  setPreference(preference) {
    localStorage.setItem(KEY, preference)
    const resolved = resolve(preference)
    applyTheme(resolved)
    set({ preference, resolved })
  },
  toggle() {
    get().setPreference(get().resolved === 'dark' ? 'light' : 'dark')
  },
}))

export function initTheme() {
  applyTheme(useTheme.getState().resolved)
  media().addEventListener('change', () => {
    const { preference } = useTheme.getState()
    if (preference !== 'system') return
    const resolved = resolve('system')
    applyTheme(resolved)
    useTheme.setState({ resolved })
  })
}
