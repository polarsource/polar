import { getAllContent, getLegalSlugs } from '@/utils/blog'
import { CONFIG } from '@/utils/config'
import fs from 'fs'
import { MetadataRoute } from 'next'
import path from 'path'

const baseUrl = 'https://polar.sh'

const LANDING_DIR = path.join(
  process.cwd(),
  'src/app/(main)/(website)/(landing)',
)

const EXTRA_ROUTES = ['/docs', '/brand']

function collectLandingRoutes(): string[] {
  const routes: string[] = []

  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) {
        if (entry.name === 'page.tsx') {
          routes.push('/' + segments.join('/'))
        }
        continue
      }
      if (!entry.isDirectory()) continue

      const { name } = entry
      if (name.startsWith('_') || name.startsWith('[')) continue

      const isRouteGroup = name.startsWith('(') && name.endsWith(')')
      walk(path.join(dir, name), isRouteGroup ? segments : [...segments, name])
    }
  }

  walk(LANDING_DIR, [])
  return routes
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Don't generate sitemap for sandbox environment
  if (CONFIG.IS_SANDBOX) {
    return []
  }

  const pageRoutes = [
    ...new Set([...collectLandingRoutes(), ...EXTRA_ROUTES]),
  ].sort()

  const pageEntries: MetadataRoute.Sitemap = pageRoutes.map((route) => ({
    url: `${baseUrl}${route === '/' ? '' : route}`,
  }))

  const contentEntries: MetadataRoute.Sitemap = getAllContent().map((post) => {
    const lastModified = post.date ? new Date(post.date) : null
    const hasValidDate = lastModified !== null && !isNaN(lastModified.getTime())

    return {
      url: `${baseUrl}${post.href}`,
      ...(hasValidDate ? { lastModified } : {}),
    }
  })

  const legalEntries: MetadataRoute.Sitemap = getLegalSlugs()
    .sort()
    .map((slug) => ({
      url: `${baseUrl}/legal/${slug}`,
    }))

  return [...pageEntries, ...contentEntries, ...legalEntries]
}
