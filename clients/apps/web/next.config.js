const POLAR_AUTH_COOKIE_KEY = 'polar_session'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['polarkit'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '**',
      },
    ],
  },

  async rewrites() {
    return [
      // Framer site rewrites
      {
        source: '/',
        destination: 'https://splendid-help-401117.framer.app/',
        missing: [
          // Do not rewrite for polar.new, polar.new has another rule below
          {
            type: 'host',
            value: 'polar.new',
          },
          // Do not rewrite if user is logged in, they'll be redirected to the app
          {
            type: 'cookie',
            key: POLAR_AUTH_COOKIE_KEY,
          },
        ],
      },
      {
        source: '/careers',
        destination: 'https://splendid-help-401117.framer.app/careers',
      },
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
    ]
  },
  async redirects() {
    return [
      // dashboard.polar.sh redirections
      {
        source: '/',
        destination: '/login/init',
        has: [
          {
            type: 'host',
            value: 'dashboard.polar.sh',
          },
        ],
        permanent: false,
      },
      {
        source: '/faq',
        destination: 'https://docs.polar.sh/faq',
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

      // Logged-out user redirection
      {
        source:
          '/(feed|for-you|posts|rewards|settings|backoffice|maintainer)(.*)',
        destination: '/login/init',
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
        ],
        missing: [
          {
            type: 'host',
            value: 'polar.new',
          },
        ],
        permanent: false,
      },
      {
        source: '/login(.*)',
        destination: '/feed',
        has: [
          {
            type: 'cookie',
            key: POLAR_AUTH_COOKIE_KEY,
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

      {
        source: '/dashboard',
        destination: '/login/init',
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
      },
      {
        source: '/promote(.*)',
        destination: '/maintainer',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/promote',
        destination: '/maintainer/:organization/promote/issues',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/promote/issues',
        destination: '/maintainer/:organization/issues/promote',
        permanent: false,
      },
      {
        source: '/maintainer/:organization/finance_new',
        destination: '/maintainer/:organization/finance_new/incoming',
        permanent: false,
      },

      // Access tokens redirect
      {
        source: '/settings/tokens',
        destination: '/settings',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig

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
