import { describe, expect, it } from 'vitest'
import { dispatch } from '../dispatcher'
import { createFaker } from '../faker'
import { extractParamNames } from '../path-match'
import { ResourceStore } from '../resource-store'
import { lintTemplate } from '../template'
import { buildDemoCollection, DEMO_TEMPLATE, STARTER_TEMPLATES } from '.'

describe('starter templates', () => {
  it.each(STARTER_TEMPLATES.map((t) => [t.name, t] as const))(
    '%s has only valid templates',
    (_, template) => {
      const collection = template.build()
      const faker = createFaker(1)
      expect(collection.endpoints.length).toBeGreaterThan(3)
      for (const endpoint of collection.endpoints) {
        const params = Object.fromEntries(
          extractParamNames(endpoint.path).map((name) => [name, '1']),
        )
        for (const variant of endpoint.variants) {
          if (variant.fromStore || !variant.body) continue
          const issues = lintTemplate(variant.body, {
            faker,
            expectJson: true,
            sampleContext: { params },
          })
          expect(issues, `${endpoint.method} ${endpoint.path} → ${variant.name}`).toEqual([])
        }
      }
      for (const resource of collection.resources) {
        expect(lintTemplate(resource.recordTemplate, { faker, expectJson: true })).toEqual([])
      }
    },
  )

  it('auth /me switches on the Authorization header', () => {
    const collection = STARTER_TEMPLATES.find((t) => t.id === 'auth')!.build()
    const ctx = {
      collections: [collection],
      appOrigin: 'http://x',
      store: new ResourceStore(),
      faker: createFaker(1),
    }
    const anon = dispatch(
      { method: 'GET', url: 'http://x/api/auth/me', headers: {}, body: '' },
      ctx,
    )!
    expect(anon.response.status).toBe(401)
    const authed = dispatch(
      {
        method: 'GET',
        url: 'http://x/api/auth/me',
        headers: { Authorization: 'Bearer abc' },
        body: '',
      },
      ctx,
    )!
    expect(authed.response.status).toBe(200)
  })

  it('the landing demo renders valid JSON', () => {
    const collection = buildDemoCollection(DEMO_TEMPLATE)
    const ctx = {
      collections: [collection],
      appOrigin: 'http://x',
      store: new ResourceStore(),
      faker: createFaker(2),
    }
    const result = dispatch(
      { method: 'GET', url: 'http://x/api/demo/users/7', headers: {}, body: '' },
      ctx,
    )!
    const body = JSON.parse(result.response.body) as { id: number; projects: unknown[] }
    expect(body.id).toBe(7)
    expect(body.projects).toHaveLength(2)
  })
})
