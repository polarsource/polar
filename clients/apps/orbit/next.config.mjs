/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['@polar-sh/orbit/icons'],
  },
  transpilePackages: ['@polar-sh/orbit', 'shiki'],
}

export default nextConfig
