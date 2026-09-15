import { Effect, Layer, ManagedRuntime } from 'effect'
import { Background, BackgroundLive } from './background'
import { makePromiseClient, type PromiseClient } from '../api/generated'
import { Api } from '../api/index'
import { apiLayer, type RunEffect, type VoidOptions } from '../api/layers'
import { checksumOf } from '../config/compile'
import type { Config, SchemaModule } from '../config/config'
import {
  identityFromHeaders,
  makeIdentityContext,
  type Ambient,
  type HeaderBag,
} from './context'
import { makeMiddleware, type Middleware } from './middleware'
import { makeQueries } from './queries'
import { Resolver, ResolverLive } from './resolve'
import { makeSnapshots } from './snapshot'
import { makeSignals } from './signals'
import { EventChanges } from '../storage/events'
import {
  makeScopes,
  type EnsureOptions,
  type Metadata,
  type Scope,
} from './scope'

export type { PromiseClient } from '../api/generated'
export type { Middleware } from './middleware'
export type { Scope } from './scope'

export interface Void<M extends SchemaModule = SchemaModule> {
  readonly api: PromiseClient
  readonly config: Config<M>
  readonly checksum: string
  /** A lookup. Nothing is created and nothing is fetched until a verb runs. */
  as(id: string): Scope<M>
  /** The idempotent create. Rejects if the identity exists under another parent. */
  ensure(id: string, options?: EnsureOptions): Promise<Scope<M>>
  /** Create a root, a tree with no customer yet. Rejects if `id` exists under a parent. */
  root(id: string, options?: { metadata?: Metadata }): Promise<Scope<M>>
  /** The ambient scope set by `scope.run` or the middleware. Throws when there is none. */
  current(): Scope<M>
  /** The ambient identity and its tags, or undefined outside any `run`. */
  ambient(): Ambient | undefined
  /** The identity carried in request headers by `scope.headers()`. */
  from(headers: HeaderBag): Scope<M>
  /** Ensures the identity for each request and runs the rest of the handler as it. */
  middleware<Req, Res>(
    resolve: (req: Req) => EnsureOptions & { identity: string },
  ): Middleware<Req, Res>
  /**
   * Forget the cached slug to id lookups. Deploying through `api.deploys` from
   * inside a long-lived process leaves this client pointing at the previous
   * generation until the cache expires; so does wiping the organization.
   */
  refresh(): Promise<void>
  /**
   * Waits for background work this client started, such as deleting confirmed
   * events from storage. On serverless platforms, hand it to the platform's
   * after-response hook, for example `waitUntil(client.flush())`, so the work
   * survives the response. Gives up after the timeout, default 5 seconds.
   */
  flush(timeoutMs?: number): Promise<void>
  /** Flushes, then shuts the runtime down. Pending requests are interrupted. */
  dispose(): Promise<void>
}

export const createVoid = <M extends SchemaModule>(
  config: Config<M>,
  options: VoidOptions,
): Void<M> => {
  const checksum = checksumOf(config)
  // Speculative signals need a local event store to read back from. Without one,
  // signals follow the server alone and recording changes nothing locally.
  const eventChanges =
    config.signals.length && config.eventStorage.length
      ? new EventChanges()
      : undefined
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(ResolverLive, BackgroundLive).pipe(
      Layer.provideMerge(
        apiLayer(
          options,
          checksum,
          config.eventStorage,
          config.eventRetention,
          eventChanges,
        ),
      ),
    ),
  )
  const run: RunEffect<Api | Resolver | Background> = (effect) =>
    runtime.runPromise(effect)
  const background = runtime.runSync(Background)
  let disposal: Promise<void> | undefined
  const context = makeIdentityContext()
  const signals = makeSignals(config, run, eventChanges)
  const queries = makeQueries(config, run, signals.query)
  const snapshots = makeSnapshots(config, run)
  const scopes = makeScopes(config, queries, snapshots, context, run)
  const api = runtime.runSync(Api)
  const client: Void<M> = {
    api: makePromiseClient(api, run),
    config,
    checksum,
    ...scopes,
    current: () => scopes.as(context.current()),
    ambient: () => context.ambient(),
    from: (headers) => scopes.as(identityFromHeaders(headers)),
    middleware: makeMiddleware(scopes.ensure),
    refresh: async () => {
      await run(Effect.flatMap(Resolver, (resolver) => resolver.reset))
      await signals.refresh()
    },
    flush: (timeoutMs = 5000) =>
      disposal ?? runtime.runPromise(background.drain(timeoutMs)),
    dispose: () =>
      (disposal ??= (async () => {
        signals.close()
        for (const detach of detached.splice(0)) detach()
        context.dispose()
        await runtime.runPromise(background.drain(5000))
        await runtime.runPromise(background.close)
        await runtime.dispose()
      })()),
  }
  // Plugins that wire something process-wide, such as AI SDK telemetry, do it here.
  const detached = config.plugins.flatMap((plugin) => {
    const detach = plugin.attach?.(client)
    return detach ? [detach] : []
  })
  return client
}
