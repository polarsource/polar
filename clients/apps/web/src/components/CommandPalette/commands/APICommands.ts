import openapiSchema from '@polar-sh/sdk/openapi'
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
  posts: FindMatchingPath<'/api/v1/articles'>[]
  issues: FindMatchingPath<'/api/v1/issues'>[]
  donations: FindMatchingPath<'/api/v1/donations'>[]
  subscriptions: FindMatchingPath<'/api/v1/subscriptions'>[]
  webhooks: FindMatchingPath<'/api/v1/webhooks'>[]
  funding: FindMatchingPath<'/api/v1/funding'>[]
}

type SitemapKey = keyof typeof sitemap

const filterPath = <T extends string>(key: T) =>
  Object.entries(openapiSchema.paths)
    .filter(([path]) => path.includes(key))
    .map(([path, methods]) => ({ path, methods }) as FindMatchingPath<T>)

const sitemap: Sitemap = {
  posts: filterPath('/api/v1/articles'),
  issues: filterPath('/api/v1/issues'),
  donations: filterPath('/api/v1/donations'),
  subscriptions: filterPath('/api/v1/subscriptions'),
  webhooks: filterPath('/api/v1/webhooks'),
  funding: filterPath('/api/v1/funding'),
}

export const createAPICommands = (key: SitemapKey): APICommand[] => {
  const site = sitemap[key]

  return site
    .map(({ path, methods }) => {
      return Object.entries(methods).map<APICommand>(([method, operation]) => {
        return {
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
