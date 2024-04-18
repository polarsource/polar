const createMDX = require('@next/mdx')

const POLAR_AUTH_COOKIE_KEY = 'polar_session'

const defaultFrontendHostname = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_FRONTEND_BASE_URL).hostname
  : 'polar.sh'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['polarkit'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],

  // Do not do any fiddling with trailing slashes
  trailingSlash: undefined,
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
    return [
      {
        source: '/404',
        destination: 'https://splendid-help-401117.framer.app/404',
      },
      {
        source: '/request',
        destination: 'https://splendid-help-401117.framer.app/request',
      },
      {
        source: '/legal/privacy',
        destination: 'https://splendid-help-401117.framer.app/legal/privacy',
      },
      {
        source: '/legal/terms',
        destination: 'https://splendid-help-401117.framer.app/legal/terms',
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
        destination: 'https://docs.polar.sh/faq/',
        permanent: false,
      },
      {
        source: '/faq/:path*',
        destination: 'https://docs.polar.sh/faq/:path*',
        permanent: false,
      },

      // Logged-out user redirection
      {
        source:
          '/:rootPath(feed|for-you|posts|subscriptions|funding|rewards|settings|backoffice|maintainer|finance):subPath(/?.*)',
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
        source: '/benefits(.*)',
        destination: '/subscriptions',
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
        source: '/maintainer/:organization/posts',
        destination: '/maintainer/:organization/posts/overview',
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

const withMDX = createMDX()

module.exports = withMDX(nextConfig)

// Injected content via Sentry wizard below

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(
  module.exports,
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
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true,
  })
  module.exports = withBundleAnalyzer(module.exports)
}
