import { assert, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import { Api, type Meter, type Product, type Reducer } from '../src/api/index'
import { VoidError } from '../src/errors'
import { Resolver, ResolverLive } from '../src/runtime/resolve'

const reducer: Reducer = {
  id: 'r1',
  slug: 'tokens',
  created_at: 't',
  type: 'scalar',
  filter: { conjunction: 'and', clauses: [] },
  aggregation: { func: 'count' },
  map: null,
}
const meter: Meter = {
  version_id: 'a'.repeat(64),
  id: 'm1',
  name: 'Token usage',
  slug: 'tokens',
  usage_reducer_id: 'r1',
  credit_reducer_id: 'credits',
  unit_amount: '1',
  currency: 'usd',
  created_at: 't',
}
let reducerCalls = 0
let meterCalls = 0
let meters: ReadonlyArray<Meter> = [meter]
const product: Product = {
  version_id: 'a'.repeat(64),
  meter_terms: {},
  id: 'p1',
  slug: 'pro',
  name: 'Pro',
  description: null,
  price: { type: 'one_time', amount: '49', currency: 'usd' },
  meters: [],
  entitlements: [],
  created_at: 't',
}
const ACTIVE = 'a'.repeat(64)
let activeVersionId: string | null = ACTIVE
const api = Layer.mock(Api, {
  organizationsCurrent: () =>
    Effect.sync(() => ({
      id: 'org',
      name: 'Org',
      slug: 'org',
      created_at: 't',
      active_deployment_id: activeVersionId === null ? null : 'deployment',
      active_version_id: activeVersionId,
      can_activate: true,
    })),
  productsList: () =>
    Effect.succeed([
      product,
      {
        ...product,
        id: 'candidate',
        version_id: 'candidate',
      },
    ]),
  reducersList: () =>
    Effect.suspend(() => {
      reducerCalls++
      return reducerCalls === 1
        ? Effect.fail(
            new VoidError({
              reason: 'unreachable',
              message: 'temporary failure',
            }),
          )
        : Effect.succeed([reducer])
    }),
  metersList: () =>
    Effect.suspend(() => {
      meterCalls++
      return meterCalls === 1
        ? Effect.fail(
            new VoidError({
              reason: 'unreachable',
              message: 'temporary failure',
            }),
          )
        : Effect.succeed(meters)
    }),
})

layer(ResolverLive.pipe(Layer.provide(api)))((it) => {
  it.effect(
    'retries failed listings, shares successful listings, refreshes and resets',
    () =>
      Effect.gen(function* () {
        const resolver = yield* Resolver
        assert.equal((yield* resolver.productBySlug('pro')).id, 'p1')
        assert.equal(
          (yield* resolver.productBySlug('pro', 'candidate')).id,
          'candidate',
        )
        assert.equal(
          (yield* Effect.flip(resolver.reducerBySlug('tokens')))._tag,
          'VoidError',
        )
        assert.equal(
          (yield* Effect.flip(resolver.meterBySlug('tokens')))._tag,
          'VoidError',
        )
        yield* Effect.all(
          [
            resolver.reducerBySlug('tokens'),
            resolver.reducerBySlug('tokens'),
            resolver.meterBySlug('tokens'),
            resolver.meterBySlug('tokens'),
          ],
          { concurrency: 'unbounded' },
        )
        assert.equal(reducerCalls, 2)
        assert.equal(meterCalls, 2)

        meters = [
          { ...meter, id: 'm2', name: 'Renamed tokens' },
          {
            ...meter,
            id: 'other',
            slug: 'other',
            name: 'tokens',
          },
          {
            ...meter,
            id: 'version',
            version_id: 'candidate',
          },
        ]
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'm1')
        yield* TestClock.adjust('61 seconds')
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'm2')
        assert.equal(
          (yield* resolver.meterBySlug('tokens', 'candidate')).id,
          'version',
        )
        yield* resolver.reducerBySlug('tokens')
        assert.equal(reducerCalls, 3)
        assert.equal(meterCalls, 3)

        yield* resolver.reset
        yield* resolver.reducerBySlug('tokens')
        yield* resolver.meterBySlug('tokens')
        assert.equal(reducerCalls, 4)
        assert.equal(meterCalls, 4)
        activeVersionId = 'candidate'
        assert.equal((yield* resolver.productBySlug('pro')).id, 'candidate')
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'version')
        assert.equal((yield* resolver.productBySlug('pro', ACTIVE)).id, 'p1')
        assert.equal((yield* resolver.meterBySlug('tokens', ACTIVE)).id, 'm2')
        activeVersionId = 'missing'
        assert.equal(
          (yield* Effect.flip(resolver.productBySlug('pro')))._tag,
          'VoidError',
        )
        assert.equal(
          (yield* resolver.productBySlug('pro', 'candidate')).id,
          'candidate',
        )
        // Nothing active: nothing resolves unless a version is named.
        activeVersionId = null
        assert.equal(
          (yield* Effect.flip(resolver.productBySlug('pro')))._tag,
          'VoidError',
        )
        assert.equal((yield* resolver.productBySlug('pro', ACTIVE)).id, 'p1')
      }),
  )
})
