import createMDX from '@next/mdx'
import rehypeSlug from 'rehype-slug';
import bundleAnalyzer from '@next/bundle-analyzer'
import { withSentryConfig } from '@sentry/nextjs'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { bundledLanguages, createHighlighter } from 'shiki';
import { themeConfig, themesList, transformers } from './shiki.config.mjs'

const POLAR_AUTH_COOKIE_KEY = 'polar_session'
const ENVIRONMENT = process.env.VERCEL_ENV ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  'development'

const defaultFrontendHostname = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_FRONTEND_BASE_URL).hostname
  : 'polar.sh'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['polarkit', 'shiki'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],

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
    return [
      // docs.polar.sh rewrite
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'docs.polar.sh',
          },
        ],
        destination: '/docs/:path*',
      },

      {
        source: '/legal/privacy',
        destination: 'https://polarsource.github.io/legal/privacy-policy.pdf',
      },
      {
        source: '/legal/terms',
        destination: 'https://polarsource.github.io/legal/terms.pdf',
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

      // PostHog Rewrite
      {
        source: '/ingest/:path*',
        destination: 'https://app.posthog.com/:path*',
      },
    ]
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

      // FAQ to docs
      {
        source: '/faq',
        destination: '/docs/overview/faq/overview',
        permanent: false,
      },
      {
        source: '/faq/:path*',
        destination: '/docs/overview/faq/:path*',
        permanent: false,
      },

      // Logged-out user redirection
      {
        source:
          '/:rootPath(feed|for-you|posts|purchases|funding|rewards|settings|backoffice|maintainer|finance):subPath(/?.*)',
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
        destination: '/feed',
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
        source: '/maintainer/:path*',
        destination: `https://${defaultFrontendHostname}/maintainer/:path*`,
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
      ...ENVIRONMENT !== 'development' ?
        [{
          source: '/docs/:path*',
          destination: 'https://docs.polar.sh/:path*',
          permanent: false,
        }]
        :
        [],

      // Generate docs redirections
      // We have to explicitly define the ones for docs.polar.sh, because redirects are evalated **before** rewrites
      ...[
        { source: '/', destination: '/overview' },
        { source: '/api', destination: '/api/introduction' },
        { source: '/guides', destination: '/guides/overview' },
      ].reduce((acc, { source, destination }) => (
        [
          ...acc,
          {
            source: `/docs${source}`,
            destination: `/docs${destination}`,
            permanent: false
          },
          {
            source: `${source}`,
            destination: `${destination}`,
            permanent: false,
            has: [
              {
                type: 'host',
                value: 'docs.polar.sh'
              }
            ]
          }
        ]
      ), []),

      {
        source: '/dashboard',
        destination: '/login',
        permanent: false,
      },

      {
        source: '/dashboard/settings/extension',
        destination: '/settings/extension',
        permanent: false,
      },

      {
        source: '/dashboard/personal',
        destination: '/feed',
        permanent: false,
      },
      {
        source: '/dashboard/:org(.*)/:repo(.*)',
        destination: '/maintainer/:org/issues?repo=:repo',
        permanent: false,
      },
      {
        source: '/dashboard/:org(.*)',
        destination: '/maintainer/:org/posts',
        permanent: false,
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
        destination: '/maintainer',
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
        destination: '/maintainer',
        permanent: false,
      },
      {
        source: '/rewards(.*)',
        destination: '/finance/rewards',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/issues',
        destination: '/maintainer/:organization/issues/overview',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/promote/issues',
        destination: '/maintainer/:organization/issues/badge',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/issues/promote',
        destination: '/maintainer/:organization/issues/badge',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/finance',
        destination: '/maintainer/:organization/finance/incoming',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/subscriptions',
        destination: '/maintainer/:organization/subscriptions/overview',
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
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeShikiFromHighlighter,
          highlighter, {
            themes: themeConfig,
            transformers,
          },
        ],
      ]
    }
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
