import { useEffect, useRef } from 'react'

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const modKey = isMac ? '⌘' : 'Ctrl'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return (
    !!el &&
    (el.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
      !!el.closest('.cm-editor'))
  )
}

/**
 * Registers a global shortcut such as `mod+k`, `alt+n` or `?`.
 * Plain-key shortcuts are ignored while the user is typing.
 */
export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const parts = combo.toLowerCase().split('+')
    const key = parts.pop()!
    const needMod = parts.includes('mod')
    const needAlt = parts.includes('alt')
    const needShift = parts.includes('shift')
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = isMac ? event.metaKey : event.ctrlKey
      if (needMod !== mod || needAlt !== event.altKey) return
      if (needShift && !event.shiftKey) return
      const pressed = event.key.toLowerCase()
      const code = event.code.toLowerCase()
      const matches = pressed === key || code === `key${key}` || code === `digit${key}`
      if (!matches) return
      if (!needMod && !needAlt && isTyping(event.target)) return
      event.preventDefault()
      ref.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, enabled])
}
