/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ['@polar-sh/orbit', '@void/sdk'],
}

export default nextConfig
