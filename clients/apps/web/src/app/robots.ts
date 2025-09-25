import { CONFIG } from '@/utils/config'
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // If this is the sandbox environment, disallow all crawlers
  if (CONFIG.IS_SANDBOX) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  // For production, allow crawling with sensible defaults
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/settings/',
        '/finance/',
        '/start/',
        '/backoffice/',
        '/login/',
        '/verify-email/',
        '/api/',
      ],
    },
    sitemap: 'https://polar.sh/sitemap.xml',
  }
}