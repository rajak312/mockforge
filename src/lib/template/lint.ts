import type { Faker } from '@faker-js/faker'
import { parseTemplate, TemplateSyntaxError, type TemplateNode } from './ast'
import { renderTemplate, resolveFaker, type TemplateContext } from './engine'

export interface TemplateDiagnostic {
  from: number
  to: number
  message: string
  severity: 'error' | 'warning'
}

function collectFakerIssues(nodes: TemplateNode[], faker: Faker, out: TemplateDiagnostic[]) {
  for (const node of nodes) {
    if (node.type === 'repeat') collectFakerIssues(node.children, faker, out)
    if (node.type !== 'expr' || node.expr.path[0] !== 'faker') continue
    const path = node.expr.path.slice(1)
    if (!resolveFaker(faker, path)) {
      out.push({
        from: node.start,
        to: node.end,
        message: `faker.${path.join('.')} does not exist. Try faker.person.fullName or faker.internet.email`,
        severity: 'error',
      })
    }
  }
}

/** Translates an offset in rendered JSON back to a rough location for messages. */
function jsonErrorMessage(error: unknown): string {
  const message = (error as Error).message
  return message.replace(/^JSON\.parse: /, '').replace(/^Unexpected token/, 'Unexpected token')
}

export interface LintOptions {
  faker: Faker
  /** When true the rendered output must be valid JSON. */
  expectJson: boolean
  sampleContext?: TemplateContext
}

/**
 * Validates a template in three passes: syntax, faker method existence and
 * (optionally) whether the rendered output parses as JSON.
 */
export function lintTemplate(source: string, options: LintOptions): TemplateDiagnostic[] {
  let ast: TemplateNode[]
  try {
    ast = parseTemplate(source)
  } catch (error) {
    if (error instanceof TemplateSyntaxError) {
      return [
        {
          from: error.from,
          to: Math.max(error.to, error.from + 1),
          message: error.message,
          severity: 'error',
        },
      ]
    }
    throw error
  }

  const issues: TemplateDiagnostic[] = []
  collectFakerIssues(ast, options.faker, issues)
  if (issues.length) return issues

  if (!options.expectJson || !source.trim()) return issues
  const rendered = renderTemplate(source, options.sampleContext ?? {}, { faker: options.faker })
  if (!rendered.ok) {
    return [{ from: rendered.from, to: rendered.to, message: rendered.error, severity: 'error' }]
  }
  try {
    JSON.parse(rendered.output)
  } catch (error) {
    issues.push({
      from: 0,
      to: Math.min(source.length, 1),
      message: `Rendered output is not valid JSON: ${jsonErrorMessage(error)}`,
      severity: 'warning',
    })
  }
  return issues
}
