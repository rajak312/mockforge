import { describe, expect, it } from 'vitest'
import { createFaker } from './faker'
import { importOpenApi, OpenApiImportError } from './openapi'
import { lintTemplate, renderTemplate } from './template'

const PETSTORE_YAML = `
openapi: 3.0.3
info:
  title: Pet Store
  description: A sample pet store
  version: 1.0.0
servers:
  - url: https://petstore.example.com/v1
paths:
  /pets:
    get:
      summary: List pets
      responses:
        '200':
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Pet'
    post:
      operationId: createPet
      responses:
        '201':
          description: Created
          content:
            application/json:
              example: { id: 1, name: Rex }
        default:
          $ref: '#/components/responses/Error'
  /pets/{petId}:
    get:
      summary: Get a pet
      responses:
        '404':
          $ref: '#/components/responses/Error'
        '200':
          description: The pet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
components:
  responses:
    Error:
      description: Unexpected error
      content:
        application/json:
          schema:
            type: object
            properties:
              code: { type: integer, minimum: 400, maximum: 599 }
              message: { type: string }
  schemas:
    Owner:
      type: object
      properties:
        email: { type: string, format: email }
        pets:
          type: array
          items: { $ref: '#/components/schemas/Pet' }
    Pet:
      allOf:
        - type: object
          properties:
            id: { type: integer }
            name: { type: string }
        - type: object
          properties:
            status: { type: string, enum: [available, pending, sold] }
            tags: { type: array, items: { type: string } }
            price: { type: number }
            vaccinated: { type: boolean }
            owner: { $ref: '#/components/schemas/Owner' }
            createdAt: { type: string, format: date-time }
`

function renderJson(template: string, ctx = {}) {
  const result = renderTemplate(template, ctx, { faker: createFaker(3) })
  if (!result.ok) throw new Error(result.error)
  return JSON.parse(result.output) as unknown
}

describe('importOpenApi', () => {
  const { collection, warnings } = importOpenApi(PETSTORE_YAML)

  it('creates a collection with converted paths and methods', () => {
    expect(collection.name).toBe('Pet Store')
    expect(collection.baseUrl).toBe('/api/pet-store')
    expect(collection.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /pets',
      'POST /pets',
      'GET /pets/:petId',
    ])
    expect(collection.endpoints[1]!.name).toBe('createPet')
    expect(warnings.some((w) => w.includes('petstore.example.com'))).toBe(true)
  })

  it('orders variants success-first and maps default to 500', () => {
    const get = collection.endpoints[2]!
    expect(get.variants.map((v) => v.status)).toEqual([200, 404])
    expect(get.activeVariantId).toBe(get.variants[0]!.id)
    const post = collection.endpoints[1]!
    expect(post.variants.map((v) => v.status)).toEqual([201, 500])
    expect(post.variants[1]!.name).toBe('Unexpected error')
  })

  it('uses explicit examples verbatim', () => {
    expect(JSON.parse(collection.endpoints[1]!.variants[0]!.body)).toEqual({ id: 1, name: 'Rex' })
  })

  it('generates valid, realistic templates from schemas (refs, allOf, enums, recursion)', () => {
    const faker = createFaker(1)
    for (const endpoint of collection.endpoints) {
      for (const variant of endpoint.variants) {
        expect(
          lintTemplate(variant.body, {
            faker,
            expectJson: true,
            sampleContext: { params: { petId: '1' } },
          }),
        ).toEqual([])
      }
    }
    const list = renderJson(collection.endpoints[0]!.variants[0]!.body) as Record<string, unknown>[]
    expect(list).toHaveLength(5)
    const pet = list[0]!
    expect(typeof pet.id).toBe('number')
    expect(typeof pet.name).toBe('string')
    expect(['available', 'pending', 'sold']).toContain(pet.status)
    expect(Array.isArray(pet.tags)).toBe(true)
    expect(typeof pet.vaccinated).toBe('boolean')
    expect((pet.owner as { email: string }).email).toContain('@')
    // Pet -> Owner -> Pet recursion is cut off with null items
    expect((pet.owner as { pets: unknown[] }).pets.every((p) => p === null)).toBe(true)
  })

  it('binds path params into response ids', () => {
    const pet = renderJson(collection.endpoints[2]!.variants[0]!.body, {
      params: { petId: '77' },
    }) as {
      id: number
    }
    expect(pet.id).toBe(77)
    const error = renderJson(collection.endpoints[2]!.variants[1]!.body) as { code: number }
    expect(error.code).toBeGreaterThanOrEqual(400)
    expect(error.code).toBeLessThanOrEqual(599)
  })

  it('accepts JSON documents', () => {
    const json = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Tiny' },
      paths: { '/ping': { get: { responses: { '204': { description: 'No content' } } } } },
    })
    const result = importOpenApi(json)
    expect(result.collection.endpoints[0]!.variants[0]!.status).toBe(204)
  })

  it('rejects invalid input with helpful errors', () => {
    expect(() => importOpenApi('')).toThrow(OpenApiImportError)
    expect(() => importOpenApi('swagger: "2.0"\npaths: {}')).toThrow(/Swagger 2.0/)
    expect(() => importOpenApi('foo: bar')).toThrow(/openapi: 3/)
    expect(() => importOpenApi('openapi: 3.0.0\npaths: {}')).toThrow(/no paths/)
    expect(() => importOpenApi('{ not json')).toThrow(/Could not parse/)
  })
})
