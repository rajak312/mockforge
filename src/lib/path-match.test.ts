import { describe, expect, it } from 'vitest'
import {
  validateBaseUrl,
  extractParamNames,
  fillPath,
  fromOpenApiPath,
  joinUrl,
  matchPath,
  normalizePath,
  parseBaseUrl,
  pathSpecificity,
  stripBaseUrl,
  toOpenApiPath,
} from './path-match'

describe('normalizePath', () => {
  it('adds a leading slash, collapses duplicates and strips trailing slash', () => {
    expect(normalizePath('users//1/')).toBe('/users/1')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('  /a ')).toBe('/a')
  })
})

describe('matchPath', () => {
  it('matches static paths', () => {
    expect(matchPath('/users', '/users')).toEqual({})
    expect(matchPath('/users', '/users/')).toEqual({})
    expect(matchPath('/users', '/posts')).toBeNull()
  })

  it('extracts named params', () => {
    expect(matchPath('/users/:id', '/users/42')).toEqual({ id: '42' })
    expect(matchPath('/users/:userId/posts/:postId', '/users/7/posts/abc')).toEqual({
      userId: '7',
      postId: 'abc',
    })
  })

  it('decodes encoded params', () => {
    expect(matchPath('/search/:term', '/search/hello%20world')).toEqual({ term: 'hello world' })
    expect(matchPath('/x/:v', '/x/%E0%A4')).toEqual({ v: '%E0%A4' })
  })

  it('does not match when segment counts differ', () => {
    expect(matchPath('/users/:id', '/users')).toBeNull()
    expect(matchPath('/users/:id', '/users/1/extra')).toBeNull()
  })

  it('supports optional trailing params', () => {
    expect(matchPath('/users/:id?', '/users')).toEqual({})
    expect(matchPath('/users/:id?', '/users/5')).toEqual({ id: '5' })
  })

  it('supports wildcards', () => {
    expect(matchPath('/files/*', '/files/a/b/c.txt')).toEqual({ '*': 'a/b/c.txt' })
    expect(matchPath('/files/*', '/files')).toEqual({ '*': '' })
  })

  it('is case sensitive for static segments', () => {
    expect(matchPath('/Users', '/users')).toBeNull()
  })
})

describe('pathSpecificity', () => {
  it('ranks static segments above params above wildcards', () => {
    expect(pathSpecificity('/users/me')).toBeGreaterThan(pathSpecificity('/users/:id'))
    expect(pathSpecificity('/users/:id')).toBeGreaterThan(pathSpecificity('/users/*'))
    expect(pathSpecificity('/users/:id/posts')).toBeGreaterThan(pathSpecificity('/users/:id'))
  })
})

describe('param helpers', () => {
  it('extracts param names', () => {
    expect(extractParamNames('/a/:x/b/:y?')).toEqual(['x', 'y'])
  })

  it('converts between OpenAPI and express style', () => {
    expect(fromOpenApiPath('/users/{userId}/posts/{id}')).toBe('/users/:userId/posts/:id')
    expect(toOpenApiPath('/users/:userId/posts/:id')).toBe('/users/{userId}/posts/{id}')
  })

  it('fills params into a pattern', () => {
    expect(fillPath('/users/:id/posts/:postId', { id: '1' })).toBe('/users/1/posts/:postId')
  })
})

describe('base URLs', () => {
  const app = 'https://mockforge.app'

  it('parses relative and absolute bases', () => {
    expect(parseBaseUrl('/api/shop/')).toEqual({ origin: null, prefix: '/api/shop' })
    expect(parseBaseUrl('https://api.example.com/v1')).toEqual({
      origin: 'https://api.example.com',
      prefix: '/v1',
    })
    expect(parseBaseUrl('https://api.example.com')).toEqual({
      origin: 'https://api.example.com',
      prefix: '',
    })
  })

  it('strips relative bases against the app origin', () => {
    expect(stripBaseUrl(new URL(`${app}/api/shop/users/1`), '/api/shop', app)).toBe('/users/1')
    expect(stripBaseUrl(new URL(`${app}/api/shop`), '/api/shop', app)).toBe('/')
    expect(stripBaseUrl(new URL(`${app}/api/shopping`), '/api/shop', app)).toBeNull()
    expect(stripBaseUrl(new URL(`https://other.dev/api/shop/x`), '/api/shop', app)).toBeNull()
  })

  it('strips absolute bases', () => {
    const base = 'https://api.example.com/v1'
    expect(stripBaseUrl(new URL('https://api.example.com/v1/users'), base, app)).toBe('/users')
    expect(stripBaseUrl(new URL('https://api.example.com/v2/users'), base, app)).toBeNull()
  })

  it('joins base URLs and paths', () => {
    expect(joinUrl('/api/shop/', '/users')).toBe('/api/shop/users')
    expect(joinUrl('https://x.dev', 'users/:id')).toBe('https://x.dev/users/:id')
    expect(joinUrl('/api', '/')).toBe('/api')
  })
})

describe('validateBaseUrl', () => {
  it('accepts prefixed relative bases and absolute URLs', () => {
    expect(validateBaseUrl('/api/shop')).toBeNull()
    expect(validateBaseUrl('https://api.example.com')).toBeNull()
  })

  it('rejects bases that would shadow the app or are malformed', () => {
    expect(validateBaseUrl('')).toMatch(/required/)
    expect(validateBaseUrl('/')).toMatch(/needs a prefix/)
    expect(validateBaseUrl('api')).toMatch(/Start with/)
    expect(validateBaseUrl('/app/x')).toMatch(/reserved/)
    expect(validateBaseUrl('/assets')).toMatch(/reserved/)
    expect(validateBaseUrl('/@vite')).toMatch(/reserved/)
    expect(validateBaseUrl('/api?x=1')).toMatch(/cannot contain/)
    expect(validateBaseUrl('https://')).toMatch(/valid absolute/)
  })

  it('allows prefixes that merely start with a reserved word', () => {
    expect(validateBaseUrl('/apps')).toBeNull()
  })
})
