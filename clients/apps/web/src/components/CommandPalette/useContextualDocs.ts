import openapiSchema from '@polar-sh/sdk/openapi'

import { usePathname } from 'next/navigation'

interface ContextualDocs {
  api: Record<string, (typeof openapiSchema)['paths']>
}

export const useContextualDocs = () => {
  const path = usePathname()
  const normalizedPath = path.split('/').slice(3).join('/')
  const sitemap = buildSitemap(normalizedPath as any)
}

type FindMatchingPath<
  A extends string,
  B = keyof (typeof openapiSchema)['paths'],
> = B extends `${infer X}${A}${infer Y}`
  ? A extends string
    ? `${X}${A}${Y}`
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
  Object.keys(openapiSchema.paths).filter((path) =>
    path.includes(key),
  ) as FindMatchingPath<T>[]

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
