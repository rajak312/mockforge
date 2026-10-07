import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  MatchDecorator,
  placeholder as placeholderExt,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/store/theme'
import { templateCompletionSource } from './completions'

export type EditorLanguage = 'template' | 'json' | 'javascript' | 'text'

const lightHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: '#6d28d9' },
  { tag: t.string, color: '#047857' },
  { tag: t.number, color: '#c2410c' },
  { tag: [t.bool, t.null], color: '#0369a1', fontWeight: '500' },
  { tag: t.keyword, color: '#7c3aed' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#1d4ed8' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.variableName, color: '#0f172a' },
  { tag: t.typeName, color: '#0e7490' },
  { tag: t.punctuation, color: '#64748b' },
])

const darkHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: '#c4b5fd' },
  { tag: t.string, color: '#6ee7b7' },
  { tag: t.number, color: '#fdba74' },
  { tag: [t.bool, t.null], color: '#7dd3fc', fontWeight: '500' },
  { tag: t.keyword, color: '#c084fc' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#93c5fd' },
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: t.variableName, color: '#e2e8f0' },
  { tag: t.typeName, color: '#67e8f9' },
  { tag: t.punctuation, color: '#94a3b8' },
])

function themeExtension(dark: boolean): Extension {
  return [
    EditorView.theme(
      {
        '&': { color: 'var(--fg)' },
        '.cm-content': { caretColor: 'var(--accent)', padding: '10px 0' },
        '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
          backgroundColor: dark ? '#2e2a5a !important' : '#ddd8ff !important',
        },
        '.cm-foldPlaceholder': {
          background: 'var(--surface-3)',
          border: 'none',
          color: 'var(--fg-muted)',
        },
      },
      { dark },
    ),
    syntaxHighlighting(dark ? darkHighlight : lightHighlight),
  ]
}

const tagDecorator = new MatchDecorator({
  regexp: /\{\{[\s\S]*?\}\}/g,
  decoration: Decoration.mark({ class: 'cm-template-tag' }),
})

const templateTags = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = tagDecorator.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = tagDecorator.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations },
)

export interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: EditorLanguage
  readOnly?: boolean
  /** Returns diagnostics for the current document (debounced by CodeMirror). */
  lint?: (doc: string) => Diagnostic[]
  /** Path params offered by `{{params.` autocompletion. */
  params?: string[]
  placeholder?: string
  ariaLabel: string
  className?: string
  lineNumbers?: boolean
  onSubmit?: () => void
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  lint,
  params = [],
  placeholder,
  ariaLabel,
  className,
  lineNumbers: showLineNumbers = true,
  onSubmit,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const lintCompartment = useRef(new Compartment())
  const readOnlyCompartment = useRef(new Compartment())
  const dark = useTheme((s) => s.resolved === 'dark')

  // Latest callbacks without recreating the editor.
  const latest = useRef({ onChange, lint, params, onSubmit })
  useEffect(() => {
    latest.current = { onChange, lint, params, onSubmit }
  })

  useEffect(() => {
    if (!host.current) return
    const languageExt =
      language === 'javascript'
        ? javascript({ typescript: true })
        : language === 'text'
          ? []
          : json()

    const extensions: Extension[] = [
      showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [],
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      languageExt,
      language === 'template' ? templateTags : [],
      autocompletion({
        override:
          language === 'template'
            ? [templateCompletionSource({ params: () => latest.current.params })]
            : undefined,
        activateOnTyping: true,
      }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            if (!latest.current.onSubmit) return false
            latest.current.onSubmit()
            return true
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
      placeholder ? placeholderExt(placeholder) : [],
      themeCompartment.current.of(themeExtension(dark)),
      readOnlyCompartment.current.of([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
      lintCompartment.current.of(
        lint
          ? [
              linter((v) => latest.current.lint?.(v.state.doc.toString()) ?? [], { delay: 250 }),
              lintGutter(),
            ]
          : [],
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) latest.current.onChange?.(update.state.doc.toString())
      }),
    ]

    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions }),
    })
    view.current = instance
    return () => {
      instance.destroy()
      view.current = null
    }
    // The editor is created once per language; value/theme sync happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, showLineNumbers, ariaLabel])

  // Sync external value changes (e.g. switching variants, formatting).
  useEffect(() => {
    const instance = view.current
    if (!instance) return
    const current = instance.state.doc.toString()
    if (current !== value) {
      instance.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: themeCompartment.current.reconfigure(themeExtension(dark)) })
  }, [dark])

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    })
  }, [readOnly])

  return <div ref={host} className={cn('min-h-0 overflow-hidden', className)} />
}

export type { Diagnostic }
