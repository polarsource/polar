/**
 * Service configuration from the environment. Fails fast with a clear message
 * if something required is missing — better at boot than mid-flush.
 */

/**
 * Which durable backend to commit events to. This is the seam that decides the
 * deployment model: a per-instance `sqlite` file is the stateful sidecar (the
 * default); a future shared/remote backend is what makes the embedded handler
 * safe to mount into a multi-instance, stateless app. See `createStore`.
 */
export type StoreConfig =
  | { readonly kind: 'sqlite'; readonly path: string }
  | { readonly kind: 'memory' }

export interface ServiceConfig {
  readonly port: number
  readonly store: StoreConfig
  /** Path to the integrator's billing module. Falls back to the bundled example. */
  readonly billingPath?: string
  readonly polar: {
    readonly token: string
    readonly server: 'production' | 'sandbox'
    readonly organizationId?: string
  }
  readonly flushIntervalMillis: number
}

const int = (value: string | undefined, fallback: number): number => {
  const n = value === undefined ? fallback : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Pick the store backend from `LOCAL_STORE` (default "sqlite"). */
const storeFromEnv = (env: Record<string, string | undefined>): StoreConfig => {
  const kind = env.LOCAL_STORE ?? 'sqlite'
  switch (kind) {
    case 'sqlite':
      return { kind: 'sqlite', path: env.LOCAL_DB_PATH ?? 'local.db' }
    case 'memory':
      return { kind: 'memory' }
    default:
      throw new Error(
        `LOCAL_STORE must be "sqlite" or "memory" (got "${kind}")`,
      )
  }
}

/** Human-readable one-liner for the boot log. */
export const describeStore = (store: StoreConfig): string =>
  store.kind === 'sqlite' ? `sqlite:${store.path}` : 'memory (ephemeral)'

export const configFromEnv = (
  env: Record<string, string | undefined> = process.env,
): ServiceConfig => {
  const token = env.POLAR_ACCESS_TOKEN
  if (!token) throw new Error('POLAR_ACCESS_TOKEN is required')

  const server = env.POLAR_SERVER ?? 'production'
  if (server !== 'production' && server !== 'sandbox') {
    throw new Error(
      `POLAR_SERVER must be "production" or "sandbox" (got "${server}")`,
    )
  }

  return {
    port: int(env.LOCAL_PORT, 8787),
    store: storeFromEnv(env),
    ...(env.LOCAL_BILLING ? { billingPath: env.LOCAL_BILLING } : {}),
    polar: {
      token,
      server,
      ...(env.POLAR_ORG_ID ? { organizationId: env.POLAR_ORG_ID } : {}),
    },
    flushIntervalMillis: int(env.LOCAL_FLUSH_INTERVAL_MS, 5000),
  }
}
