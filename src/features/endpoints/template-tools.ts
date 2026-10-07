import type { Diagnostic } from '@codemirror/lint'
import { createFaker } from '@/lib/faker'
import { lintTemplate, renderTemplate, type TemplateContext } from '@/lib/template'

const lintFaker = createFaker(42)

/** Adapts template diagnostics to CodeMirror's lint format. */
export function makeTemplateLinter(expectJson: boolean, sampleContext: TemplateContext) {
  return (doc: string): Diagnostic[] =>
    lintTemplate(doc, { faker: lintFaker, expectJson, sampleContext }).map((d) => ({
      from: Math.min(d.from, doc.length),
      to: Math.min(Math.max(d.to, d.from), doc.length),
      message: d.message,
      severity: d.severity,
    }))
}

export interface PreviewResult {
  ok: boolean
  output: string
  message: string
  /** 1-based line of the template error, when known. */
  line?: number
  bytes: number
  ms: number
}

function lineOf(source: string, offset: number) {
  return source.slice(0, offset).split('\n').length
}

export function renderPreview(
  template: string,
  ctx: TemplateContext,
  seed: number,
  expectJson: boolean,
): PreviewResult {
  const started = performance.now()
  const result = renderTemplate(template, ctx, {
    faker: createFaker(seed),
    escape: expectJson ? 'json' : 'none',
  })
  const ms = performance.now() - started
  if (!result.ok) {
    return {
      ok: false,
      output: '',
      message: result.error,
      line: lineOf(template, result.from),
      bytes: 0,
      ms,
    }
  }
  const bytes = new TextEncoder().encode(result.output).length
  if (!expectJson || !result.output.trim())
    return { ok: true, output: result.output, message: '', bytes, ms }
  try {
    return {
      ok: true,
      output: JSON.stringify(JSON.parse(result.output), null, 2),
      message: '',
      bytes,
      ms,
    }
  } catch (error) {
    return {
      ok: false,
      output: result.output,
      message: `Rendered output is not valid JSON — ${(error as Error).message}`,
      bytes,
      ms,
    }
  }
}
