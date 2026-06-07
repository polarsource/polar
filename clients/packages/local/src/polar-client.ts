/**
 * The Polar API client — built on the monorepo's `@polar-sh/client`, the typed
 * `openapi-fetch` client generated from Polar's OpenAPI schema. Using it means
 * our event-ingest, meter, and quantity calls are checked against the real API
 * shape rather than hand-rolled URLs and JSON.
 *
 * Our modules depend on the `PolarClient` type and are handed an instance, so
 * tests can pass a structural fake without any network.
 */
import { createClient, type Client } from '@polar-sh/client'

export type PolarClient = Client

const SERVERS = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
} as const

export interface PolarClientOptions {
  /** Organization Access Token. */
  readonly token: string
  /** Hosted environment. Default "production". `baseUrl` overrides it. */
  readonly server?: keyof typeof SERVERS
  readonly baseUrl?: string
}

export const polarClient = (options: PolarClientOptions): PolarClient =>
  createClient(
    options.baseUrl ?? SERVERS[options.server ?? 'production'],
    options.token,
  )
