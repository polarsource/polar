/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Trying to add another entry point, for the content script
  // webpack: (config) => {
  //   return {
  //     ...config,
  //     entry: async () => {
  //       const entry = await config.entry()
  //       return {
  //         ...entry,
  //         'content': ['./src/index.tsx'],
  //       }
  //     },
  //   }
  // },
}

module.exports = nextConfig
