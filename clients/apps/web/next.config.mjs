import bundleAnalyzer from '@next/bundle-analyzer'
import createMDX from '@next/mdx'
import { withSentryConfig } from '@sentry/nextjs'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import rehypeMdxImportMedia from 'rehype-mdx-import-media'
import rehypeSlug from 'rehype-slug'
import remarkFlexibleToc from 'remark-flexible-toc'
import { bundledLanguages, createHighlighter } from 'shiki'
import { themeConfig, themesList, transformers } from './shiki.config.mjs'

const POLAR_AUTH_COOKIE_KEY = 'polar_session'
const ENVIRONMENT =
  process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development'

const defaultFrontendHostname = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_FRONTEND_BASE_URL).hostname
  : 'polar.sh'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['polarkit', 'shiki'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  images: {
    remotePatterns: [
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
    return {
      beforeFiles: [
        // PostHog Rewrite
        {
          source: '/ingest/static/:path*',
          destination: 'https://us-assets.i.posthog.com/static/:path*',
        },
        {
          source: '/ingest/:path*',
          destination: 'https://us.i.posthog.com/:path*',
        },

        {
          source: '/legal/privacy',
          destination: 'https://polarsource.github.io/legal/privacy-policy.pdf',
        },
        {
          source: '/legal/terms',
          destination: 'https://polarsource.github.io/legal/terms.pdf',
        },

        // docs.polar.sh rewrite
        {
          // The rewrite happens before everything else, so we need to make sure
          // it doesn't match the _next and assets directories
          source: '/:path((?!_next|assets).*)',
          has: [
            {
              type: 'host',
              value: 'docs.polar.sh',
            },
          ],
          destination: '/docs/:path',
        },

        // polar.new rewrite
        {
          source: '/',
          destination: '/new',
          has: [
            {
              type: 'host',
              value: 'polar.new',
            },
          ],
        },
      ],
    }
  },
  async redirects() {
    return [
      // dashboard.polar.sh redirections
      {
        source: '/',
        destination: '/login',
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
        source: '/docs/overview/ads',
        destination: '/docs/benefits/ads',
        permanent: true,
      },
      {
        source: '/docs/issue-funding/overview',
        destination: '/docs/issue-funding',
        permanent: true,
      },

      // Redirect /docs/overview/:path to /docs/:path
      {
        source: '/docs/overview/:path*',
        destination: '/docs/:path*',
        permanent: true,
      },

      {
        source: '/docs/subscriptions',
        destination: '/docs/products',
        permanent: true,
      },

      // Redirect old FAQ to docs.polar.sh
      ...(ENVIRONMENT === 'production'
        ? [
            {
              source: '/faq',
              destination: 'https://docs.polar.sh/faq/overview',
              has: [
                {
                  type: 'host',
                  value: 'polar.sh',
                },
              ],
              permanent: true,
            },
            {
              source: '/faq/:path*',
              destination: 'https://docs.polar.sh/faq/:path*',
              has: [
                {
                  type: 'host',
                  value: 'polar.sh',
                },
              ],
              permanent: true,
            },
          ]
        : []),

      {
        source:
          '/:rootPath(dashboard|feed|for-you|posts|purchases|funding|rewards|settings|backoffice|maintainer|finance):subPath(/?.*)',
        destination: '/login?return_to=/:rootPath:subPath',
        missing: [
          {
            type: 'cookie',
            key: POLAR_AUTH_COOKIE_KEY,
          },
          {
            type: 'host',
            value: 'polar.new',
          },
        ],
        has: [
          {
            type: 'host',
            value: defaultFrontendHostname,
          },
        ],
        permanent: false,
      },

      // Logged-in user redirections
      {
        source: '/',
        destination: '/dashboard',
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
        missing: [
          {
            type: 'host',
            value: 'polar.new',
          },
        ],
        permanent: false,
      },

      // Redirect polar.new/anything (but not "polar.new/") to "polar.new/"
      {
        source: '/(.+)',
        destination: 'https://polar.new',
        has: [
          {
            type: 'host',
            value: 'polar.new',
          },
        ],
        permanent: false,
      },

      // Redirect /maintainer to polar.sh if on a different domain name
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

      // Redirect /docs to docs.polar.sh
      ...(ENVIRONMENT === 'production'
        ? [
            {
              source: '/docs/:path*',
              destination: 'https://docs.polar.sh/:path*',
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
        source: '/dependencies(.*)',
        destination: '/feed',
        permanent: false,
      },
      {
        source: '/finance',
        destination: '/finance/incoming',
        permanent: false,
      },
      {
        source: '/issues(.*)',
        destination: '/dashboard',
        permanent: false,
        has: [
          {
            type: 'host',
            value: defaultFrontendHostname,
          },
        ],
      },
      {
        source: '/promote(.*)',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/rewards(.*)',
        destination: '/finance/rewards',
        permanent: false,
      },
      {
        source: '/dashboard/:organization/overview',
        destination: '/dashboard/:organization',
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
        destination: '/dashboard/:organization/finance/incoming',
        permanent: false,
      },

      {
        source: '/posts',
        destination: '/feed',
        permanent: false,
        has: [
          {
            type: 'host',
            value: defaultFrontendHostname,
          },
        ],
      },

      // Access tokens redirect
      {
        source: '/settings/tokens',
        destination: '/settings',
        permanent: false,
      },

      // Old blog redirects
      {
        // https://blog.polar.sh/funding-goals-reward-contributors-v1-backer-dashboard-api/
        source:
          '/funding-goals-reward-contributors-v1-backer-dashboard-api(.*)',
        destination:
          'https://polar.sh/polarsource/posts/funding-goals-reward-contributors-v1-backer-dashboard-api',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'blog.polar.sh',
          },
        ],
      },

      {
        // https://blog.polar.sh/polar-v1-0-lets-fix-open-source-funding/
        source: '/polar-v1-0-lets-fix-open-source-funding(.*)',
        destination:
          'https://polar.sh/polarsource/posts/polar-v1-0-lets-fix-open-source-funding',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'blog.polar.sh',
          },
        ],
      },

      {
        // https://blog.polar.sh/new-funding-page-method-a-better-backer-experience/
        source: '/new-funding-page-method-a-better-backer-experience(.*)',
        destination:
          'https://polar.sh/polarsource/posts/new-funding-page-method-a-better-backer-experience',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'blog.polar.sh',
          },
        ],
      },

      {
        // https://blog.polar.sh/introducing-rewards/
        source: '/introducing-rewards(.*)',
        destination: 'https://polar.sh/polarsource/posts/introducing-rewards',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'blog.polar.sh',
          },
        ],
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
    ]
  },
}

const createConfig = async () => {
  const highlighter = await createHighlighter({
    langs: Object.keys(bundledLanguages),
    themes: themesList,
  })
  const withMDX = createMDX({
    options: {
      remarkPlugins: [
        remarkFlexibleToc,
        () => (tree, file) => ({
          ...tree,
          children: [
            // Wrap the main content of the MDX file in a BodyWrapper (div) component
            // so we might position the TOC on the right side of the content
            {
              type: 'mdxJsxFlowElement',
              name: 'BodyWrapper',
              attributes: [],
              children: tree.children,
            },
            // Automatically add a TOCGenerator component to the end of the MDX file
            // using the TOC data from the remarkFlexibleToc plugin
            {
              type: 'mdxJsxFlowElement',
              name: 'TOCGenerator',
              attributes: [
                {
                  type: 'mdxJsxAttribute',
                  name: 'items',
                  value: JSON.stringify(file.data.toc),
                },
              ],
              children: [],
            },
          ],
        }),
      ],
      rehypePlugins: [
        rehypeMdxImportMedia,
        rehypeSlug,
        [
          rehypeShikiFromHighlighter,
          highlighter,
          {
            themes: themeConfig,
            transformers,
          },
        ],
      ],
    },
  })

  let conf = withMDX(nextConfig)

  // Injected content via Sentry wizard below

  conf = withSentryConfig(
    conf,
    {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      // Suppresses source map uploading logs during build
      silent: true,

      org: 'polar-sh',
      project: 'dashboard',
    },
    {
      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Transpiles SDK to be compatible with IE11 (increases bundle size)
      transpileClientSDK: true,

      // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
      tunnelRoute: '/monitoring',

      // Hides source maps from generated client bundles
      hideSourceMaps: true,

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,
    },
  )

  if (process.env.ANALYZE === 'true') {
    const withBundleAnalyzer = bundleAnalyzer({
      enabled: true,
    })
    conf = withBundleAnalyzer(conf)
  }

  return conf
}

export default createConfig
