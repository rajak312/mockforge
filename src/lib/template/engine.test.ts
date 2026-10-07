import { describe, expect, it } from 'vitest'
import { createFaker } from '../faker'
import {
  lintTemplate,
  parseExpression,
  parseTemplate,
  renderTemplate,
  TemplateSyntaxError,
} from '.'

const fixedNow = () => new Date('2026-01-02T03:04:05.000Z')
const render = (source: string, ctx = {}, seed = 1) =>
  renderTemplate(source, ctx, { faker: createFaker(seed), now: fixedNow })

function output(source: string, ctx = {}) {
  const result = render(source, ctx)
  if (!result.ok) throw new Error(result.error)
  return result.output
}

describe('parseExpression', () => {
  it('parses dotted paths, call args, space args and fallbacks', () => {
    expect(parseExpression('faker.person.fullName')).toEqual({
      path: ['faker', 'person', 'fullName'],
      args: [],
      explicitCall: false,
    })
    expect(parseExpression('faker.number.int({"min": 1, "max": 3})').args).toEqual([
      { min: 1, max: 3 },
    ])
    expect(parseExpression('int 5 10').args).toEqual([5, 10])
    expect(parseExpression('pick "a b" \'c\'').args).toEqual(['a b', 'c'])
    expect(parseExpression('query.limit ?? 10').fallback).toBe(10)
    expect(parseExpression('query.sort ?? "asc"').fallback).toBe('asc')
  })

  it('rejects unknown roots and prototype access', () => {
    expect(() => parseExpression('window.alert')).toThrow(/Unknown variable "window"/)
    expect(() => parseExpression('body.__proto__')).toThrow(/Forbidden/)
    expect(() => parseExpression('faker')).toThrow(/faker method/)
    expect(() => parseExpression('faker.number.int({min:1})')).toThrow(/valid JSON/)
  })
})

describe('parseTemplate', () => {
  it('reports unclosed blocks with offsets', () => {
    const source = '[{{#repeat 2}}1'
    try {
      parseTemplate(source)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateSyntaxError)
      expect((error as TemplateSyntaxError).from).toBe(1)
    }
  })

  it('reports unclosed tags and stray closing blocks', () => {
    expect(() => parseTemplate('{"a": "{{uuid"}')).toThrow(/Unclosed tag/)
    expect(() => parseTemplate('{{/repeat}}')).toThrow(/without an opening block/)
    expect(() => parseTemplate('{{#each items}}{{/each}}')).toThrow(/Only #repeat/)
    expect(() => parseTemplate('{{#repeat 5000}}{{/repeat}}')).toThrow(/at most/)
  })

  it('ignores comments', () => {
    expect(output('a{{! a comment }}b')).toBe('ab')
  })
})

describe('renderTemplate', () => {
  it('interpolates request params, query, body and headers', () => {
    const ctx = {
      params: { id: '42' },
      query: { page: '2' },
      body: { email: 'lalit@example.com', profile: { role: 'admin' } },
      headers: { 'X-Tenant': 'acme' },
    }
    expect(
      output(
        '{"id": "{{params.id}}", "page": {{query.page}}, "email": "{{body.email}}", "role": "{{body.profile.role}}", "tenant": "{{headers.x-tenant}}"}',
        ctx,
      ),
    ).toBe(
      '{"id": "42", "page": 2, "email": "lalit@example.com", "role": "admin", "tenant": "acme"}',
    )
  })

  it('applies fallbacks for missing values', () => {
    expect(output('{"page": {{query.page ?? 1}}, "sort": "{{query.sort ?? "asc"}}"}')).toBe(
      '{"page": 1, "sort": "asc"}',
    )
  })

  it('renders faker values deterministically for a given seed', () => {
    const a = output('{{faker.person.fullName}}')
    const b = output('{{faker.person.fullName}}')
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(3)
  })

  it('passes JSON args to faker', () => {
    for (let i = 0; i < 20; i++) {
      const value = Number(
        (
          renderTemplate(
            '{{faker.number.int({"min": 5, "max": 7})}}',
            {},
            { faker: createFaker(i) },
          ) as {
            output: string
          }
        ).output,
      )
      expect(value).toBeGreaterThanOrEqual(5)
      expect(value).toBeLessThanOrEqual(7)
    }
  })

  it('supports built-in helpers', () => {
    expect(output('{{now}}')).toBe('2026-01-02T03:04:05.000Z')
    expect(output('{{timestamp}}')).toBe(String(fixedNow().getTime()))
    expect(output('{{uuid}}')).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number(output('{{int 3 3}}'))).toBe(3)
    expect(output('{{pick "only"}}')).toBe('only')
    expect(['true', 'false']).toContain(output('{{bool}}'))
  })

  it('repeats blocks as comma separated JSON items with @index', () => {
    const json = output('[{{#repeat 3}}{"i": {{@index}}}{{/repeat}}]')
    expect(JSON.parse(json)).toEqual([{ i: 0 }, { i: 1 }, { i: 2 }])
  })

  it('tolerates a trailing comma inside repeat blocks and nests repeats', () => {
    const json = output(
      '[{{#repeat 2}}{"tags": [{{#repeat 2}}"t{{@index}}",{{/repeat}}]},{{/repeat}}]',
    )
    expect(JSON.parse(json)).toEqual([{ tags: ['t0', 't1'] }, { tags: ['t0', 't1'] }])
  })

  it('repeats a random count within a range', () => {
    const items = JSON.parse(output('[{{#repeat 2 4}}1{{/repeat}}]')) as number[]
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.length).toBeLessThanOrEqual(4)
  })

  it('escapes strings so output stays valid JSON', () => {
    const json = output('{"q": "{{body.text}}"}', { body: { text: 'say "hi"\nnow' } })
    expect(JSON.parse(json)).toEqual({ q: 'say "hi"\nnow' })
  })

  it('serialises objects and arrays', () => {
    expect(output('{{body}}', { body: { a: [1, 2] } })).toBe('{"a":[1,2]}')
  })

  it('does not escape when escape mode is none', () => {
    const result = renderTemplate(
      'Hello "{{body.n}}"',
      { body: { n: 'A"B' } },
      { faker: createFaker(1), escape: 'none' },
    )
    expect(result).toEqual({ ok: true, output: 'Hello "A"B"' })
  })

  it('returns errors with positions instead of throwing', () => {
    const result = render('{"x": "{{faker.nope.nothing}}"}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not a faker method/)
      expect(result.from).toBe(7)
    }
  })
})

describe('lintTemplate', () => {
  const faker = createFaker(1)

  it('returns no diagnostics for valid templates', () => {
    expect(
      lintTemplate('{"name": "{{faker.person.fullName}}"}', { faker, expectJson: true }),
    ).toEqual([])
  })

  it('flags unknown faker methods', () => {
    const [issue] = lintTemplate('{"x": "{{faker.person.nope}}"}', { faker, expectJson: true })
    expect(issue?.message).toMatch(/does not exist/)
    expect(issue?.from).toBe(7)
  })

  it('warns when rendered output is not JSON', () => {
    const [issue] = lintTemplate('{"x": {{uuid}}}', { faker, expectJson: true })
    expect(issue?.severity).toBe('warning')
    expect(issue?.message).toMatch(/not valid JSON/)
  })

  it('skips JSON validation for non JSON bodies', () => {
    expect(lintTemplate('plain {{uuid}}', { faker, expectJson: false })).toEqual([])
  })
})
