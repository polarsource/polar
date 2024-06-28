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
  products: FindMatchingPath<'/v1/products'>[]
  issues: FindMatchingPath<'/v1/issues'>[]
  donations: FindMatchingPath<'/v1/donations'>[]
  subscriptions: FindMatchingPath<'/v1/subscriptions'>[]
  benefits: FindMatchingPath<'/v1/benefits'>[]
  newsletters: FindMatchingPath<'/v1/articles'>[]
  users: FindMatchingPath<'/v1/users'>[]
  accounts: FindMatchingPath<'/v1/accounts'>[]
  webhooks: FindMatchingPath<'/v1/webhooks'>[]
  funding: FindMatchingPath<'/v1/funding'>[]
  oauth: FindMatchingPath<'/v1/oauth'>[]
}

type SitemapKey = keyof typeof sitemap

const filterPath = <T extends string>(key: T) =>
  Object.entries(openapiSchema.paths)
    .filter(([path]) => path.includes(key))
    .map(([path, methods]) => ({ path, methods }) as FindMatchingPath<T>)

const sitemap: Sitemap = {
  products: filterPath('/v1/products'),
  issues: filterPath('/v1/issues'),
  donations: filterPath('/v1/donations'),
  subscriptions: filterPath('/v1/subscriptions'),
  benefits: filterPath('/v1/benefits'),
  newsletters: filterPath('/v1/articles'),
  users: filterPath('/v1/users'),
  accounts: filterPath('/v1/accounts'),
  webhooks: filterPath('/v1/webhooks'),
  funding: filterPath('/v1/funding'),
  oauth: filterPath('/v1/oauth'),
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
            router.push(`/docs/api/${path}/${method}`)
          },
        }
      })
    })
    .flat()
}
