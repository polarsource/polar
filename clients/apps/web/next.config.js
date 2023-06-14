/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['polarkit'],
  async rewrites() {
    return [
      {
        source: '/',
        destination: 'https://splendid-help-401117.framer.app/',
      },
      {
        source: '/faq',
        destination: 'https://splendid-help-401117.framer.app/faq',
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
    ]
  },
}

module.exports = nextConfig
