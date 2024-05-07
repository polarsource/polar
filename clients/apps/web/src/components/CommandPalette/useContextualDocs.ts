import openapiSchema from '@polar-sh/sdk/openapi'
import { usePathname } from 'next/navigation'

export const useContextualDocs = () => {
  const path = usePathname()
  const normalizedPath = path.split('/').slice(3).join('/')
  const sitemap = buildSitemap(normalizedPath as keyof Sitemap)

  return sitemap
}

type FindMatchingPath<
  A extends string,
  B extends
    keyof (typeof openapiSchema)['paths'] = keyof (typeof openapiSchema)['paths'],
> = B extends `${infer X}${A}${infer Y}`
  ? A extends string
    ? {
        path: `${X}${A}${Y}`
        methods: (typeof openapiSchema)['paths'][B]
      }
    : never
  : never

type Sitemap = {
  posts: FindMatchingPath<'/api/v1/articles'>[]
  issues: FindMatchingPath<'/api/v1/issues'>[]
  donations: FindMatchingPath<'/api/v1/donations'>[]
  subscriptions: FindMatchingPath<'/api/v1/subscriptions'>[]
  webhooks: FindMatchingPath<'/api/v1/webhooks'>[]
}

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
}

// Returns a sitemap value if the path is somewhat similar to the sitemap key
const buildSitemap = (path: keyof typeof sitemap) => {
  const keys = Object.keys(sitemap)
  const key = keys.find((k) => path.includes(k))

  return sitemap[key as keyof typeof sitemap]
}
