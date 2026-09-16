import { Cache, Context, Effect, Exit, Layer } from 'effect'
import {
  Api,
  type ApiError,
  type Meter,
  type Product,
  type Reducer,
} from '../api/index'
import { VoidError } from '../errors'

/**
 * Maps config keys to server IDs and caches successful listings for one minute.
 * Failed listings are retried on the next lookup. Reducers use their slug;
 * products and meters belong to a configuration version, the organization's
 * active one unless a version is requested.
 */
export class Resolver extends Context.Service<
  Resolver,
  {
    readonly reducerBySlug: (slug: string) => Effect.Effect<Reducer, ApiError>
    readonly meterBySlug: (
      slug: string,
      versionId?: string,
    ) => Effect.Effect<Meter, ApiError>
    readonly productBySlug: (
      slug: string,
      versionId?: string,
    ) => Effect.Effect<Product, ApiError>
    /** Forget cached listings, for example after a deploy. */
    readonly reset: Effect.Effect<void>
  }
>()('void/Resolver') {}

const inVersion = <T extends { slug: string; version_id: string }>(
  rows: ReadonlyArray<T>,
  slug: string,
  versionId: string | null,
) =>
  versionId === null
    ? undefined
    : rows.find((row) => row.slug === slug && row.version_id === versionId)

const notDeployed = (kind: string, key: string) =>
  new VoidError({
    reason: 'not_deployed',
    message: `${kind} ${key} is not deployed; run \`void deploy\``,
  })

export const ResolverLive = Layer.effect(Resolver)(
  Effect.gen(function* () {
    const api = yield* Api
    // Successful listings live a minute; failures are retried on the next lookup.
    const timeToLive = (exit: Exit.Exit<unknown, unknown>) =>
      Exit.isSuccess(exit) ? '1 minute' : 0
    const reducers = yield* Cache.makeWith(() => api.reducersList(undefined), {
      capacity: 1,
      timeToLive,
    })
    const meters = yield* Cache.makeWith(() => api.metersList(undefined), {
      capacity: 1,
      timeToLive,
    })
    const products = yield* Cache.makeWith(
      () => api.productsList({ params: {} }),
      { capacity: 1, timeToLive },
    )
    return {
      reducerBySlug: (slug) =>
        Effect.flatMap(Cache.get(reducers, undefined), (all) => {
          const found = all.find((reducer) => reducer.slug === slug)
          return found
            ? Effect.succeed(found)
            : Effect.fail(notDeployed('reducer', slug))
        }),
      meterBySlug: (slug, versionId) =>
        Effect.gen(function* () {
          const selected =
            versionId === undefined
              ? (yield* api.organizationsCurrent(undefined)).active_version_id
              : versionId
          const all = yield* Cache.get(meters, undefined)
          const found = inVersion(all, slug, selected)
          return found ? found : yield* Effect.fail(notDeployed('meter', slug))
        }),
      productBySlug: (slug, versionId) =>
        Effect.gen(function* () {
          const selected =
            versionId === undefined
              ? (yield* api.organizationsCurrent(undefined)).active_version_id
              : versionId
          const all = yield* Cache.get(products, undefined)
          const found = inVersion(all, slug, selected)
          return found
            ? found
            : yield* Effect.fail(notDeployed('product', slug))
        }),
      reset: Effect.all(
        [
          Cache.invalidateAll(reducers),
          Cache.invalidateAll(meters),
          Cache.invalidateAll(products),
        ],
        { discard: true },
      ),
    }
  }),
)
