import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

const POLAR_SERVERS = {
  'polar-mcp': 'https://api.polar.sh',
  'polar-sandbox': 'https://sandbox-api.polar.sh',
}

const LOCAL_POLAR_SERVERS = {
  'polar-local': 'http://127.0.0.1:8000',
}

export default defineConfig(({ mode }) => ({
  worker: {
    name: 'polar-mcp',
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint,
    env: {
      LOADER: bindings.workerLoader(),
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
