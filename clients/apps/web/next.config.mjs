import bundleAnalyzer from '@next/bundle-analyzer'
import createMDX from '@next/mdx'
import { withSentryConfig } from '@sentry/nextjs'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import rehypeMdxImportMedia from 'rehype-mdx-import-media'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkFlexibleToc from 'remark-flexible-toc'
import { bundledLanguages, createHighlighter } from 'shiki'
import { themeConfig, themesList, transformers } from './shiki.config.mjs'

const POLAR_AUTH_COOKIE_KEY = process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session'
const ENVIRONMENT =
  process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development'
const CODESPACES = process.env.CODESPACES === 'true'

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

  // Since Codespaces run behind a proxy, we need to allow it for Server-Side Actions, like cache revalidation
  // See: https://github.com/vercel/next.js/issues/58019
  ...CODESPACES ? {
    experimental: {
      serverActions: {
        allowedForwardedHosts: [`${process.env.CODESPACE_NAME}-8080.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`, "localhost:8080", "127.0.0.1:8080"],
        allowedOrigins: [`${process.env.CODESPACE_NAME}-8080.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`, "localhost:8080", "127.0.0.1:8080"],
      },
    },
  } : {},

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
      ...(ENVIRONMENT === 'production'
        ? [
          {
            source: '/:id*',
            destination: 'https://polar.sh/api/checkout?price=:id*',
            has: [
              {
                type: 'host',
                value: 'buy.polar.sh',
              },
            ],
            permanent: false,
          }
        ] : []),
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

      // Feature pages
      {
        source: '/products',
        destination: 'https://docs.polar.sh/products',
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
        permanent: true,
      },
      {
        source: '/newsletters',
        destination: 'https://docs.polar.sh/newsletters',
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
        permanent: true,
      },
      {
        source: '/issue-funding',
        destination: 'https://docs.polar.sh/issue-funding',
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
        permanent: true,
      },
      {
        source: '/donations',
        destination: 'https://docs.polar.sh/donations',
        has: [
          {
            type: 'host',
            value: 'polar.sh',
          },
        ],
        permanent: true,
      },

      // Redirect /:slug/subscriptions to /:slug
      // Now we surface subscriptions on landing page vs. below subpage
      {
        source: '/:slug/subscriptions',
        destination: '/:slug',
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
          '/:rootPath(start|dashboard|feed|for-you|posts|purchases|funding|rewards|settings|backoffice|maintainer|finance):subPath(/?.*)',
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
        destination: '/purchases',
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
        remarkGfm,
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

      org: "polar-sh",
      project: "dashboard",

      // Pass the auth token
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Automatically annotate React components to show their full name in breadcrumbs and session replay
      reactComponentAnnotation: {
        enabled: true,
      },

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      tunnelRoute: "/monitoring",

      // Hides source maps from generated client bundles
      hideSourceMaps: true,

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,

      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,
    }
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
