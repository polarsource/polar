import { vi } from 'vitest'

export const evaluate =
  vi.fn<() => Promise<{ result?: string; error?: string }>>()
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
}
export const exports = {
  PolarApiOutbound: vi.fn(() => ({ fetch: vi.fn() })),
}
export class WorkerEntrypoint {
  constructor(public ctx: { props: unknown }) {}
}
