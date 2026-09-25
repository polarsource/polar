/* global process */
import createMDX from '@next/mdx'
import { withSentryConfig } from '@sentry/nextjs'
import { themeConfig } from './shiki.config.mjs'
import {
  docsCSP,
  embeddedCSP,
  ENVIRONMENT,
  nonEmbeddedCSP,
  oauth2CSP,
} from './src/csp.mjs'

const PREVIEW_BUILD = process.env.POLAR_PREVIEW_BUILD === '1'

// Vercel preview: compute basePath and API URL from PR number + Tailscale hostname
let previewBasePath = ''
if (
  process.env.VERCEL_GIT_PULL_REQUEST_ID &&
  process.env.POLAR_PREVIEW_BACKEND_HOST
) {
  const prNum = parseInt(process.env.VERCEL_GIT_PULL_REQUEST_ID)
  previewBasePath = `/pr-${prNum}`
  const baseUrl = `https://${process.env.POLAR_PREVIEW_BACKEND_HOST}${previewBasePath}`
  process.env.NEXT_PUBLIC_API_URL = baseUrl
  process.env.NEXT_PUBLIC_FRONTEND_BASE_URL = baseUrl
}

// Vercel services deployments: deployment URLs change with
// every deployment, so derive base from the deployment's own URL
const VERCEL_SERVICES =
  process.env.NEXT_PUBLIC_POLAR_VERCEL_SERVICES_ENABLED === '1'
if (
  VERCEL_SERVICES &&
  !process.env.NEXT_PUBLIC_FRONTEND_BASE_URL &&
  process.env.VERCEL_URL
) {
  process.env.NEXT_PUBLIC_FRONTEND_BASE_URL = `https://${process.env.VERCEL_URL}`
}

const POLAR_AUTH_COOKIE_KEY =
  process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session'
const defaultFrontendHostname = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_FRONTEND_BASE_URL).hostname
  : 'polar.sh'

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', '*.taildbff7b.ts.net'],
  reactStrictMode: true,
  experimental: {
    useTypeScriptCli: false,
  },
  transpilePackages: ['shiki', '@polar-sh/checkout', '@polar-sh/orbit'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],

  ...(previewBasePath && {
    basePath: previewBasePath,
    env: {
      POLAR_API_URL: `https://${process.env.POLAR_PREVIEW_BACKEND_HOST}:8443${previewBasePath}`,
    },
  }),

  ...(PREVIEW_BUILD && {
    typescript: { ignoreBuildErrors: true },
  }),

  outputFileTracingIncludes: {
    '/onboarding/validate-description': [
      './src/app/(main)/onboarding/validate-description/acceptable-use-policy.mdx',
    ],
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  webpack: (config, { dev }) => {
    if (config.cache && !dev) {
      config.cache = Object.freeze({
        type: 'memory',
      })
    }

    return config
  },

  images: {
    // Vercel services deployments do not wire the image optimizer yet
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === '1',
    remotePatterns: [
      ...(process.env.S3_PUBLIC_IMAGES_BUCKET_HOSTNAME
        ? [
            {
              protocol: process.env.S3_PUBLIC_IMAGES_BUCKET_PROTOCOL || 'https',
              hostname: process.env.S3_PUBLIC_IMAGES_BUCKET_HOSTNAME,
              port: process.env.S3_PUBLIC_IMAGES_BUCKET_PORT || '',
              pathname: process.env.S3_PUBLIC_IMAGES_BUCKET_PATHNAME || '**',
            },
          ]
        : []),
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '7vk6rcnylug0u6hg.public.blob.vercel-storage.com',
        port: '',
        pathname: '**',
      },
    ],
  },

  async rewrites() {
    const apiUrl = process.env.POLAR_API_URL || process.env.NEXT_PUBLIC_API_URL
    return [
      ...(PREVIEW_BUILD && apiUrl
        ? [
            {
              source: '/v1/:path*',
              destination: `${apiUrl}/v1/:path*`,
            },
            {
              source: '/backoffice/:path*',
              destination: `${apiUrl}/backoffice/:path*`,
            },
            {
              source: '/healthz',
              destination: `${apiUrl}/healthz`,
            },
            {
              source: '/openapi.json',
              destination: `${apiUrl}/openapi.json`,
            },
          ]
        : []),
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },

  async redirects() {
    return [
      // dashboard.polar.sh redirections
      {
        source: '/',
        destination: '/auth',
        has: [
          {
            type: 'host',
            value: 'dashboard.polar.sh',
          },
        ],
        permanent: false,
      },
      {
        source: '/:path*',
        destination: 'https://polar.sh/:path*',
        has: [
          {
            type: 'host',
            value: 'dashboard.polar.sh',
          },
        ],
        permanent: false,
      },
      {
        source: '/careers',
        destination: 'https://polar.sh/company',
        permanent: false,
      },
      {
        source: '/legal/terms',
        destination: 'https://polar.sh/legal/master-services-terms',
        permanent: false,
      },
      {
        source: '/legal/privacy',
        destination: 'https://polar.sh/legal/privacy-policy',
        permanent: false,
      },
      {
        source: '/llms.txt',
        destination: 'https://polar.sh/docs/llms.txt',
        permanent: true,
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
      },
      {
        source: '/llms-full.txt',
        destination: 'https://polar.sh/docs/llms-full.txt',
        permanent: true,
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
      },

      // Logged-in user redirections
      {
        source: '/',
        destination: '/start',
        has: [
          {
            type: 'cookie',
            key: POLAR_AUTH_COOKIE_KEY,
          },
          {
            type: 'host',
            value: defaultFrontendHostname,
          },
        ],
        permanent: false,
      },

      // Redirect /dashboard to correct domain if on a different domain name
      // Skip in preview builds — preview env uses a single domain via Caddy proxy
      ...(!previewBasePath
        ? [
            {
              source: '/dashboard/:path*',
              destination: `https://${defaultFrontendHostname}/dashboard/:path*`,
              missing: [
                {
                  type: 'host',
                  value: defaultFrontendHostname,
                },
                {
                  type: 'header',
                  key: 'x-forwarded-host',
                  value: defaultFrontendHostname,
                },
              ],
              permanent: false,
            },
          ]
        : []),

      {
        source: '/maintainer',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/maintainer/:path(.*)',
        destination: '/dashboard/:path(.*)',
        permanent: true,
      },
      {
        source: '/finance',
        destination: '/finance/income',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/overview',
        destination: '/dashboard/:organization',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/benefits',
        destination: '/dashboard/:organization/products/benefits',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/products/overview',
        destination: '/dashboard/:organization/products',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/issues',
        destination: '/dashboard/:organization/issues/overview',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/promote/issues',
        destination: '/dashboard/:organization/issues/badge',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/issues/promote',
        destination: '/dashboard/:organization/issues/badge',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/finance',
        destination: '/dashboard/:organization/finance/income',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/usage-billing',
        destination: '/dashboard/:organization/products/meters',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/usage-billing/meters',
        destination: '/dashboard/:organization/products/meters',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/usage-billing/events',
        destination: '/dashboard/:organization/analytics/events',
        permanent: true,
      },
      {
        source: '/dashboard/:organization/usage-billing/spans',
        destination: '/dashboard/:organization/analytics/costs',
        permanent: true,
      },

      // Account Settings Redirects
      {
        source: '/settings',
        destination: '/dashboard/account/preferences',
        permanent: true,
      },

      // Access tokens redirect
      {
        source: '/settings/tokens',
        destination: '/account/developer',
        permanent: false,
      },

      // Old blog redirects
      {
        source: '/polarsource/posts',
        destination: '/blog',
        permanent: false,
      },
      {
        source: '/polarsource/posts/:path(.*)',
        destination: '/blog/:path*',
        permanent: false,
      },

      // Fallback blog redirect
      {
        source: '/:path*',
        destination: 'https://polar.sh/polarsource',
        has: [
          {
            type: 'host',
            value: 'blog.polar.sh',
          },
        ],
        permanent: false,
      },

      // CLI Install Script
      {
        source: '/install.sh',
        destination:
          'https://raw.githubusercontent.com/polarsource/cli/main/install.sh',
        permanent: false,
      },

      {
        source: '/signup',
        destination: '/auth',
        permanent: false,
      },
    ]
  },
  async headers() {
    const baseHeaders = [
      {
        key: 'Content-Security-Policy',
        value: nonEmbeddedCSP(),
      },
      {
        key: 'Permissions-Policy',
        value:
          'payment=(), publickey-credentials-get=(), camera=(), microphone=(), geolocation=()',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
    ]

    // Add X-Robots-Tag header for sandbox environment
    if (ENVIRONMENT === 'sandbox') {
      baseHeaders.push({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
      })
    }

    return [
      {
        source: '/((?!checkout|embed|oauth2|docs).*)',
        headers: baseHeaders,
      },
      {
        source: '/oauth2/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: oauth2CSP(),
          },
          {
            key: 'Permissions-Policy',
            value:
              'payment=(), publickey-credentials-get=(), camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          ...(ENVIRONMENT === 'sandbox'
            ? [
                {
                  key: 'X-Robots-Tag',
                  value:
                    'noindex, nofollow, noarchive, nosnippet, noimageindex',
                },
              ]
            : []),
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: `payment=*, publickey-credentials-get=*, camera=(), microphone=(), geolocation=()`,
          },
          ...(ENVIRONMENT === 'sandbox'
            ? [
                {
                  key: 'X-Robots-Tag',
                  value:
                    'noindex, nofollow, noarchive, nosnippet, noimageindex',
                },
              ]
            : []),
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: embeddedCSP(),
          },
          {
            key: 'Permissions-Policy',
            value: `payment=*, publickey-credentials-get=*, camera=(), microphone=(), geolocation=()`,
          },
          ...(ENVIRONMENT === 'sandbox'
            ? [
                {
                  key: 'X-Robots-Tag',
                  value:
                    'noindex, nofollow, noarchive, nosnippet, noimageindex',
                },
              ]
            : []),
        ],
      },
      {
        source: '/docs/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: docsCSP(),
          },
          {
            key: 'Permissions-Policy',
            value:
              'payment=(), publickey-credentials-get=(), camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          ...(ENVIRONMENT === 'sandbox'
            ? [
                {
                  key: 'X-Robots-Tag',
                  value:
                    'noindex, nofollow, noarchive, nosnippet, noimageindex',
                },
              ]
            : []),
        ],
      },
    ]
  },
}

const createConfig = async () => {
  const withMDX = createMDX({
    options: {
      remarkPlugins: ['remark-frontmatter', 'remark-gfm'],
      rehypePlugins: [
        'rehype-slug',
        [
          '@shikijs/rehype',
          {
            themes: themeConfig,
          },
        ],
      ],
    },
  })

  let conf = withMDX(nextConfig)

  // Injected content via Sentry wizard below

  conf = withSentryConfig(conf, {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: 'polar-sh',
    project: 'dashboard',

    // Pass the auth token
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    reactComponentAnnotation: {
      enabled: false,
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  })

  return conf
}

export default createConfig
