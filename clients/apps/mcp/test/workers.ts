import { vi } from 'vitest'

export const evaluate = vi.fn<
  () => Promise<{
    result?: string
    error?: string
    errorName?: string
    status?: number
    body?: unknown
    requests?: number
    calls?: Array<{ method: string; url: string; status: number }>
  }>
>()
export const get = vi.fn<
  (
    _name: string | null,
    _getCode: () => WorkerLoaderWorkerCode,
  ) => { getEntrypoint: () => { evaluate: typeof evaluate } }
>(() => ({ getEntrypoint: () => ({ evaluate }) }))
export const env = {
  POLAR_SERVERS: {
    'polar-mcp': 'https://api.polar.test',
    'polar-sandbox': 'https://sandbox-api.polar.test',
  },
  LOADER: { get },
  MINTLIFY_SEARCH_KEY: 'mint_dsc_test',
  MCP_ANALYTICS_SECRET: 'analytics-secret-test',
  POSTHOG_PROJECT_KEY: '',
}
export const waitUntil = vi.fn<(promise: Promise<unknown>) => void>()
export const exports = {
  PolarApiOutbound: vi.fn(() => ({ fetch: vi.fn() })),
}
export class WorkerEntrypoint {
  constructor(public ctx: { props: unknown }) {}
}
