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
    const framerSite = 'https://splendid-help-401117-c8eb03c29.framer.app'

    return [
      // Framer site rewrites
      {
        source: '/',
        destination: `${framerSite}/`,
        missing: [
          {
            type: 'host',
            value: 'polar.new', // do not rewrite for polar.new, polar.new has another rule below
          },
        ],
      },
      {
        source: '/faq',
        destination: `${framerSite}/faq`,
      },
      {
        source: '/careers',
        destination: `${framerSite}/careers`,
      },
      {
        source: '/404',
        destination: `${framerSite}/404`,
      },
      {
        source: '/request',
        destination: `${framerSite}/request`,
      },
      {
        source: '/legal/privacy',
        destination: `${framerSite}/legal/privacy`,
      },
      {
        source: '/legal/terms',
        destination: `${framerSite}/legal/terms`,
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
      {
        source: '/',
        destination: '/dashboard',
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
    ]
  },
}

module.exports = nextConfig
