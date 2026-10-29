import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

const POLAR_SERVERS = {
  'polar-mcp': 'https://api.polar.sh',
  'polar-lovable': 'https://api.polar.sh',
  'polar-sandbox': 'https://sandbox-api.polar.sh',
}

const LOCAL_POLAR_SERVERS = {
  'polar-local': process.env.POLAR_LOCAL_API_URL ?? 'http://127.0.0.1:8000',
}

export default defineConfig(({ mode }) => ({
  worker: {
    name: 'polar-mcp',
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint,
    env: {
      LOADER: bindings.workerLoader(),
      MINTLIFY_SEARCH_KEY: bindings.secret(),
      MCP_ANALYTICS_SECRET: bindings.secret(),
      POSTHOG_PROJECT_KEY: bindings.text(
        mode === 'development'
          ? (process.env.POSTHOG_PROJECT_KEY ?? '')
          : 'phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz',
      ),
      SENTRY_DSN: bindings.text(process.env.SENTRY_DSN ?? ''),
      SENTRY_RELEASE: bindings.text(process.env.SENTRY_RELEASE ?? ''),
      SENTRY_ENVIRONMENT: bindings.text(
        mode === 'development' ? 'development' : 'production',
      ),
      POLAR_SERVERS: bindings.json(
        mode === 'development'
          ? { ...POLAR_SERVERS, ...LOCAL_POLAR_SERVERS }
          : POLAR_SERVERS,
      ),
    },
    observability: {
      enabled: true,
    },
  },
}))
