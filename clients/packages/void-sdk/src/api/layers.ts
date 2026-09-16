import { type Effect, Layer, Redacted } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { ApiLive, VoidConfig, type ApiError } from './index'
import type { EventStorage } from '../storage/storage'
import type { EventChanges } from '../storage/events'

export interface VoidOptions {
  readonly apiUrl: string
  /** Organization access token or user token for this client. */
  readonly token: string
  /** Sent as Polar-Organization-ID. Required for user tokens that can access more than one organization. */
  readonly organizationId?: string
  /** Overrides the global fetch, for tests and custom agents. */
  readonly fetch?: typeof globalThis.fetch
}

/** Shared transport for organization operations and schema-bound clients. */
export const apiLayer = (
  { apiUrl, token, organizationId, fetch }: VoidOptions,
  checksum?: string,
  eventStorage: readonly EventStorage[] = [],
  eventRetention?: number,
  eventChanges?: EventChanges,
) =>
  ApiLive.pipe(
    Layer.provide(
      Layer.succeed(VoidConfig)({
        apiUrl,
        token: Redacted.make(token),
        organizationId,
        eventStorage,
        eventRetention,
        eventChanges,
        ...(checksum && { checksum }),
      }),
    ),
    Layer.provide(
      fetch === undefined
        ? FetchHttpClient.layer
        : FetchHttpClient.layer.pipe(
            Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)),
          ),
    ),
  )

/** Execute an internal operation at the public Promise interface. */
export type RunEffect<R> = <A>(
  effect: Effect.Effect<A, ApiError, R>,
) => Promise<A>
