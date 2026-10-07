export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type RuleSource = 'param' | 'query' | 'header' | 'body'
export type RuleOperator = 'equals' | 'notEquals' | 'contains' | 'exists' | 'regex'

export interface MatchRule {
  id: string
  source: RuleSource
  /** Param / query / header name, or a dot path into the JSON body (e.g. `user.role`). */
  key: string
  operator: RuleOperator
  value: string
}

export interface ResponseVariant {
  id: string
  name: string
  status: number
  headers: KeyValue[]
  /** Artificial latency in milliseconds. */
  delay: number
  /** Template source. Rendered with the template engine on every request. */
  body: string
  /** Used when the endpoint selection mode is `rules`. All rules must match. */
  rules: MatchRule[]
  /** CRUD endpoints only: serve this variant from the stateful resource store. */
  fromStore?: boolean
}

export type VariantSelection = 'active' | 'rules'

export interface QueryMatcher {
  id: string
  key: string
  /** Empty string means "must be present with any value". */
  value: string
}

export type CrudAction = 'list' | 'get' | 'create' | 'update' | 'delete'

export interface CrudBinding {
  resourceId: string
  action: CrudAction
}

export interface Endpoint {
  id: string
  name: string
  description: string
  method: HttpMethod
  /** Path relative to the collection base URL, e.g. `/users/:id`. */
  path: string
  enabled: boolean
  query: QueryMatcher[]
  variants: ResponseVariant[]
  activeVariantId: string
  selection: VariantSelection
  /** When set, the endpoint is served by the stateful resource store. */
  crud?: CrudBinding
}

export interface CrudResource {
  id: string
  /** Plural resource name, e.g. `users`. */
  name: string
  /** Path relative to the collection base URL, e.g. `/users`. */
  path: string
  idField: string
  seedCount: number
  /** Template rendering a single record. */
  recordTemplate: string
}

export interface Collection {
  id: string
  name: string
  description: string
  /** Relative path prefix (`/api/shop`) or absolute origin (`https://api.example.com`). */
  baseUrl: string
  endpoints: Endpoint[]
  resources: CrudResource[]
  createdAt: number
  updatedAt: number
}

export interface MockRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

export interface MockResponse {
  status: number
  headers: Record<string, string>
  body: string
  delay: number
}
