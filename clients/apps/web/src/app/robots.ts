import { CONFIG } from '@/utils/config'
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  if (CONFIG.IS_SANDBOX) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/login/', '/verify-email/'],
    },
    sitemap: 'https://polar.sh/sitemap.xml',
  }
}
