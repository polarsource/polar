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

  const disallow = ['/dashboard/', '/auth/', '/verify-email/']

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      {
        userAgent: [
          'OAI-SearchBot',
          'ChatGPT-User',
          'GPTBot',
          'PerplexityBot',
          'Perplexity-User',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: '/',
        disallow,
      },
    ],
    sitemap: 'https://polar.sh/sitemap.xml',
  }
}
