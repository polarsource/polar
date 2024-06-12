import openapiSchema from '@/openapi.json'
import { OpenAPIV3_1 } from 'openapi-types'
import { APICommand } from './commands'

type SchemaPaths = (typeof openapiSchema)['paths']
type SchemaPathKey = keyof SchemaPaths
type SchemaPathMethods<T extends SchemaPathKey> = SchemaPaths[T]

type FindMatchingPath<
  A extends string,
  B extends SchemaPathKey = SchemaPathKey,
> = B extends `${infer X}${A}${infer Y}`
  ? A extends string
    ? {
        path: `${X}${A}${Y}`
        methods: SchemaPathMethods<B>
      }
    : never
  : never

type Sitemap = {
  products: FindMatchingPath<'/api/v1/products'>[]
  issues: FindMatchingPath<'/api/v1/issues'>[]
  donations: FindMatchingPath<'/api/v1/donations'>[]
  subscriptions: FindMatchingPath<'/api/v1/subscriptions'>[]
  benefits: FindMatchingPath<'/api/v1/benefits'>[]
  newsletters: FindMatchingPath<'/api/v1/articles'>[]
  users: FindMatchingPath<'/api/v1/users'>[]
  accounts: FindMatchingPath<'/api/v1/accounts'>[]
  webhooks: FindMatchingPath<'/api/v1/webhooks'>[]
  funding: FindMatchingPath<'/api/v1/funding'>[]
  oauth: FindMatchingPath<'/api/v1/oauth'>[]
}

type SitemapKey = keyof typeof sitemap

const filterPath = <T extends string>(key: T) =>
  Object.entries(openapiSchema.paths)
    .filter(([path]) => path.includes(key))
    .map(([path, methods]) => ({ path, methods }) as FindMatchingPath<T>)

const sitemap: Sitemap = {
  products: filterPath('/api/v1/products'),
  issues: filterPath('/api/v1/issues'),
  donations: filterPath('/api/v1/donations'),
  subscriptions: filterPath('/api/v1/subscriptions'),
  benefits: filterPath('/api/v1/benefits'),
  newsletters: filterPath('/api/v1/articles'),
  users: filterPath('/api/v1/users'),
  accounts: filterPath('/api/v1/accounts'),
  webhooks: filterPath('/api/v1/webhooks'),
  funding: filterPath('/api/v1/funding'),
  oauth: filterPath('/api/v1/oauth'),
}

export const createAPICommands = (key: SitemapKey): APICommand[] => {
  const site = sitemap[key]

  return site
    .map(({ path, methods }) => {
      return Object.entries(methods).map<APICommand>(([method, operation]) => {
        return {
          id: `${key}-${path}-${method}`,
          name: operation.summary,
          description: path,
          type: 3,
          endpointPath: path,
          method: method as OpenAPIV3_1.HttpMethods,
          operation,
          action: ({ hidePalette, router }) => {
            hidePalette()
            router.push(`/docs/api-reference/${path}/${method}`)
          },
        }
      })
    })
    .flat()
}
