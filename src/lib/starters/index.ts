import { createResource, generateCrudEndpoints } from '../crud'
import {
  createCollection,
  createEndpoint,
  createKeyValue,
  createVariant,
  JSON_HEADER,
} from '../factory'
import { createId } from '../id'
import type { Collection, MatchRule } from '../types'

export interface StarterTemplate {
  id: string
  name: string
  description: string
  icon: 'shopping-cart' | 'newspaper' | 'shield'
  highlights: string[]
  build: () => Collection
}

const rule = (r: Omit<MatchRule, 'id'>): MatchRule => ({ id: createId(), ...r })

function ecommerce(): Collection {
  const products = createResource('products', { seedCount: 24 })
  return createCollection({
    name: 'E-commerce API',
    description: 'Catalog, cart and checkout for an online store.',
    baseUrl: '/api/shop',
    resources: [products],
    endpoints: [
      ...generateCrudEndpoints(products),
      createEndpoint({
        name: 'List categories',
        method: 'GET',
        path: '/categories',
        variants: [
          createVariant({
            body: `[
  {{#repeat 6}}
  {
    "id": {{@index}},
    "name": "{{faker.commerce.department}}",
    "productCount": {{int 4 120}}
  }
  {{/repeat}}
]`,
          }),
        ],
      }),
      createEndpoint({
        name: 'Search products',
        description: 'Echoes the search term and returns 3–8 matching products.',
        method: 'GET',
        path: '/search',
        variants: [
          createVariant({
            delay: 350,
            body: `{
  "query": "{{query.q ?? "all"}}",
  "results": [
    {{#repeat 3 8}}
    {
      "id": "{{uuid}}",
      "name": "{{faker.commerce.productName}}",
      "price": {{faker.commerce.price}},
      "rating": {{float 1 5 1}}
    }
    {{/repeat}}
  ]
}`,
          }),
        ],
      }),
      createEndpoint({
        name: 'Get cart',
        method: 'GET',
        path: '/cart',
        variants: [
          createVariant({
            body: `{
  "id": "{{uuid}}",
  "currency": "USD",
  "items": [
    {{#repeat 1 4}}
    {
      "productId": {{int 1 24}},
      "name": "{{faker.commerce.productName}}",
      "quantity": {{int 1 3}},
      "unitPrice": {{faker.commerce.price({"min": 5, "max": 300})}}
    }
    {{/repeat}}
  ],
  "updatedAt": "{{now}}"
}`,
          }),
          createVariant({
            name: 'Empty cart',
            body: '{\n  "id": "{{uuid}}",\n  "currency": "USD",\n  "items": []\n}',
          }),
        ],
      }),
      createEndpoint({
        name: 'Checkout',
        description: 'Send {"paymentMethod": "declined_card"} to simulate a declined payment.',
        method: 'POST',
        path: '/checkout',
        selection: 'rules',
        variants: [
          createVariant({
            name: 'Order placed',
            status: 201,
            delay: 600,
            body: `{
  "orderId": "{{uuid}}",
  "status": "confirmed",
  "paymentMethod": "{{body.paymentMethod ?? "card"}}",
  "total": {{faker.commerce.price({"min": 20, "max": 900})}},
  "estimatedDelivery": "{{faker.date.soon({"days": 7})}}"
}`,
          }),
          createVariant({
            name: 'Payment declined',
            status: 402,
            delay: 600,
            body: '{\n  "error": "payment_declined",\n  "message": "Your card was declined. Try another payment method."\n}',
            rules: [
              rule({
                source: 'body',
                key: 'paymentMethod',
                operator: 'equals',
                value: 'declined_card',
              }),
            ],
          }),
        ],
      }),
      createEndpoint({
        name: 'Get order',
        description: 'Order 0 returns a 404 via a matching rule.',
        method: 'GET',
        path: '/orders/:id',
        selection: 'rules',
        variants: [
          createVariant({
            name: 'Found',
            body: `{
  "id": "{{params.id}}",
  "status": "{{pick "processing" "shipped" "delivered"}}",
  "customer": {
    "name": "{{faker.person.fullName}}",
    "email": "{{faker.internet.email}}",
    "address": "{{faker.location.streetAddress}}, {{faker.location.city}}"
  },
  "placedAt": "{{faker.date.recent({"days": 30})}}"
}`,
          }),
          createVariant({
            name: 'Not found',
            status: 404,
            body: '{\n  "error": "order_not_found",\n  "message": "No order with id {{params.id}}"\n}',
            rules: [rule({ source: 'param', key: 'id', operator: 'equals', value: '0' })],
          }),
        ],
      }),
    ],
  })
}

function blog(): Collection {
  const posts = createResource('posts', { seedCount: 18 })
  return createCollection({
    name: 'Blog API',
    description: 'Posts, comments, authors and a paginated feed.',
    baseUrl: '/api/blog',
    resources: [posts],
    endpoints: [
      ...generateCrudEndpoints(posts),
      createEndpoint({
        name: 'Feed',
        description: 'Try ?page=2 — the page number is echoed back.',
        method: 'GET',
        path: '/feed',
        variants: [
          createVariant({
            delay: 200,
            body: `{
  "page": {{query.page ?? 1}},
  "perPage": 5,
  "items": [
    {{#repeat 5}}
    {
      "id": "{{uuid}}",
      "title": "{{faker.book.title}}",
      "excerpt": "{{faker.hacker.phrase}}",
      "author": "{{faker.person.fullName}}",
      "readingMinutes": {{int 2 14}},
      "publishedAt": "{{faker.date.recent({"days": 60})}}"
    }
    {{/repeat}}
  ]
}`,
          }),
        ],
      }),
      createEndpoint({
        name: 'Post comments',
        method: 'GET',
        path: '/posts/:postId/comments',
        variants: [
          createVariant({
            body: `[
  {{#repeat 2 6}}
  {
    "id": {{@index}},
    "postId": {{params.postId}},
    "author": "{{faker.internet.username}}",
    "avatar": "{{faker.image.avatar}}",
    "body": "{{faker.hacker.phrase}}",
    "likes": {{int 0 250}}
  }
  {{/repeat}}
]`,
          }),
        ],
      }),
      createEndpoint({
        name: 'Author profile',
        method: 'GET',
        path: '/authors/:username',
        variants: [
          createVariant({
            body: `{
  "username": "{{params.username}}",
  "name": "{{faker.person.fullName}}",
  "bio": "{{faker.person.bio}}",
  "website": "{{faker.internet.url}}",
  "followers": {{int 10 50000}},
  "joinedAt": "{{faker.date.past({"years": 5})}}"
}`,
          }),
        ],
      }),
      createEndpoint({
        name: 'Popular tags',
        method: 'GET',
        path: '/tags',
        variants: [createVariant({ body: '[{{#repeat 8}}"{{faker.word.noun}}"{{/repeat}}]' })],
      }),
      createEndpoint({
        name: 'Subscribe to newsletter',
        description: 'Emails containing "taken" return 409.',
        method: 'POST',
        path: '/newsletter/subscribe',
        selection: 'rules',
        variants: [
          createVariant({
            name: 'Subscribed',
            status: 201,
            body: '{\n  "email": "{{body.email}}",\n  "subscribed": true,\n  "subscribedAt": "{{now}}"\n}',
          }),
          createVariant({
            name: 'Already subscribed',
            status: 409,
            body: '{\n  "error": "already_subscribed",\n  "message": "{{body.email}} is already on the list"\n}',
            rules: [rule({ source: 'body', key: 'email', operator: 'contains', value: 'taken' })],
          }),
        ],
      }),
    ],
  })
}

function auth(): Collection {
  const user = `{
    "id": "{{uuid}}",
    "email": "{{body.email ?? "ada@example.com"}}",
    "name": "{{faker.person.fullName}}",
    "avatar": "{{faker.image.avatar}}",
    "roles": ["user"]
  }`
  return createCollection({
    name: 'Auth API',
    description: 'Login, registration, sessions and password reset flows.',
    baseUrl: '/api/auth',
    endpoints: [
      createEndpoint({
        name: 'Log in',
        description: 'Password "wrong" → 401, email containing "locked" → 423.',
        method: 'POST',
        path: '/login',
        selection: 'rules',
        variants: [
          createVariant({
            name: 'Authenticated',
            delay: 400,
            body: `{
  "accessToken": "{{faker.string.alphanumeric(40)}}",
  "refreshToken": "{{faker.string.alphanumeric(40)}}",
  "expiresIn": 3600,
  "user": ${user}
}`,
          }),
          createVariant({
            name: 'Invalid credentials',
            status: 401,
            delay: 400,
            body: '{\n  "error": "invalid_credentials",\n  "message": "Email or password is incorrect"\n}',
            rules: [rule({ source: 'body', key: 'password', operator: 'equals', value: 'wrong' })],
          }),
          createVariant({
            name: 'Account locked',
            status: 423,
            body: '{\n  "error": "account_locked",\n  "message": "Too many attempts. Try again in 15 minutes."\n}',
            rules: [rule({ source: 'body', key: 'email', operator: 'contains', value: 'locked' })],
          }),
        ],
      }),
      createEndpoint({
        name: 'Register',
        method: 'POST',
        path: '/register',
        variants: [
          createVariant({
            name: 'Created',
            status: 201,
            delay: 500,
            body: `{\n  "user": ${user.replace(/\n {2}/g, '\n')}\n}`,
          }),
          createVariant({
            name: 'Validation error',
            status: 422,
            body: '{\n  "error": "validation_failed",\n  "fields": {\n    "password": "Must be at least 8 characters"\n  }\n}',
          }),
        ],
      }),
      createEndpoint({
        name: 'Current user',
        description: 'Returns 401 unless an Authorization header is sent.',
        method: 'GET',
        path: '/me',
        selection: 'rules',
        variants: [
          createVariant({
            name: 'Unauthorized',
            status: 401,
            headers: [JSON_HEADER(), createKeyValue('WWW-Authenticate', 'Bearer')],
            body: '{\n  "error": "unauthorized",\n  "message": "Missing or invalid access token"\n}',
          }),
          createVariant({
            name: 'Signed in',
            body: `{
  "id": "{{uuid}}",
  "email": "{{faker.internet.email}}",
  "name": "{{faker.person.fullName}}",
  "plan": "{{pick "free" "pro" "team"}}",
  "lastLoginAt": "{{faker.date.recent}}"
}`,
            rules: [
              rule({
                source: 'header',
                key: 'Authorization',
                operator: 'regex',
                value: '^Bearer .+',
              }),
            ],
          }),
        ],
      }),
      createEndpoint({
        name: 'Refresh token',
        method: 'POST',
        path: '/refresh',
        variants: [
          createVariant({
            body: '{\n  "accessToken": "{{faker.string.alphanumeric(40)}}",\n  "expiresIn": 3600\n}',
          }),
        ],
      }),
      createEndpoint({
        name: 'Log out',
        method: 'POST',
        path: '/logout',
        variants: [createVariant({ name: 'Logged out', status: 204, body: '', headers: [] })],
      }),
      createEndpoint({
        name: 'Forgot password',
        method: 'POST',
        path: '/forgot-password',
        variants: [
          createVariant({
            name: 'Email sent',
            status: 202,
            delay: 800,
            body: '{\n  "message": "If {{body.email}} exists, a reset link is on its way."\n}',
          }),
        ],
      }),
    ],
  })
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce API',
    description:
      'Products (stateful CRUD), cart, search and a checkout with a declined-card scenario.',
    icon: 'shopping-cart',
    highlights: ['Stateful products', 'Rule-based errors', 'Search echo'],
    build: ecommerce,
  },
  {
    id: 'blog',
    name: 'Blog API',
    description:
      'Posts (stateful CRUD), paginated feed, comments, authors and a newsletter signup.',
    icon: 'newspaper',
    highlights: ['Pagination', 'Nested resources', 'Conflict rules'],
    build: blog,
  },
  {
    id: 'auth',
    name: 'Auth API',
    description: 'Login with failure modes, registration, /me guarded by an Authorization header.',
    icon: 'shield',
    highlights: ['Header rules', '401 / 423 flows', 'Tokens'],
    build: auth,
  },
]

/** The tiny collection powering the live demo on the landing page. */
export const DEMO_COLLECTION_ID = 'landing-demo'
export const DEMO_TEMPLATE = `{
  "id": {{params.id}},
  "name": "{{faker.person.fullName}}",
  "email": "{{faker.internet.email}}",
  "role": "{{pick "admin" "editor" "viewer"}}",
  "projects": [
    {{#repeat 2}}
    { "name": "{{faker.commerce.productName}}", "stars": {{int 0 900}} }
    {{/repeat}}
  ]
}`

export function buildDemoCollection(template: string): Collection {
  return {
    ...createCollection({ name: 'Landing demo', baseUrl: '/api/demo' }),
    id: DEMO_COLLECTION_ID,
    endpoints: [
      createEndpoint({
        method: 'GET',
        path: '/users/:id',
        variants: [createVariant({ body: template, delay: 120 })],
      }),
    ],
  }
}
