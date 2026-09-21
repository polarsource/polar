/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ['@polar-sh/orbit', '@void/sdk'],
}

export default nextConfig
