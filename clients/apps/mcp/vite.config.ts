import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare(),
    sentryVitePlugin({
      org: 'polar-sh',
      project: 'mcp',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      release: { name: process.env.SENTRY_RELEASE },
      sourcemaps: { filesToDeleteAfterUpload: ['.cloudflare/output/**/*.map'] },
    }),
  ],
  build: { sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false },
  server: { host: '127.0.0.1', port: 8788 },
})
